package main

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/websocket"
)

const telemetryInterval = 5 * time.Second

type telemetryReading struct {
	Type                 string  `json:"type"`
	AgentID              string  `json:"agent_id"`
	CPUTemp              float64 `json:"cpu_temp,omitempty"`
	Timestamp            string  `json:"timestamp"`
	WaterVaporPressure   float64 `json:"water_vapor_pressure,omitempty"`
	WaterProductionRate  float64 `json:"water_production_rate,omitempty"`
	TemperatureSource    string  `json:"temperature_source,omitempty"`
	TelemetryIntervalSec int     `json:"telemetry_interval_sec"`
	Error                string  `json:"error,omitempty"`
}

func telemetryWebsocketHandler(ws *websocket.Conn) {
	defer ws.Close()

	ticker := time.NewTicker(telemetryInterval)
	defer ticker.Stop()

	for {
		reading := currentTelemetryReading()
		if err := websocket.JSON.Send(ws, reading); err != nil {
			return
		}

		<-ticker.C
	}
}

func allowTelemetryWebsocketOrigin(_ *websocket.Config, _ *http.Request) error {
	// add restrictions later
	return nil
}

func currentTelemetryReading() telemetryReading {
	now := time.Now().UTC()
	temp, source, err := readServerTemperatureC()

	reading := telemetryReading{
		Type:                 "reading",
		AgentID:              "server",
		Timestamp:            now.Format(time.RFC3339Nano),
		TemperatureSource:    source,
		TelemetryIntervalSec: int(telemetryInterval / time.Second),
	}

	if err != nil {
		reading.Error = err.Error()
		return reading
	}

	reading.CPUTemp = roundFloat(temp, 2)
	reading.WaterVaporPressure = roundFloat(calculateWaterVaporPressure(temp), 2)
	reading.WaterProductionRate = roundFloat(estimateWaterProductionRate(temp), 6)

	return reading
}

func readServerTemperatureC() (float64, string, error) {
	if explicitTemp := strings.TrimSpace(os.Getenv("DRIP_TEMPERATURE_C")); explicitTemp != "" {
		temp, err := strconv.ParseFloat(explicitTemp, 64)
		if err != nil {
			return 0, "env", fmt.Errorf("parse DRIP_TEMPERATURE_C: %w", err)
		}
		return temp, "env", nil
	}

	if temp, err := readVcgencmdTemperature(); err == nil {
		return temp, "vcgencmd", nil
	}

	if temp, source, err := readLinuxThermalZoneTemperature(); err == nil {
		return temp, source, nil
	}

	if temp, source, err := readLinuxHwmonTemperature(); err == nil {
		return temp, source, nil
	}

	return 0, "", errors.New("no server temperature sensor found")
}

func readVcgencmdTemperature() (float64, error) {
	if _, err := exec.LookPath("vcgencmd"); err != nil {
		return 0, err
	}

	output, err := exec.Command("vcgencmd", "measure_temp").Output()
	if err != nil {
		return 0, err
	}

	value := strings.TrimSpace(string(output))
	value = strings.TrimPrefix(value, "temp=")
	value = strings.TrimSuffix(value, "'C")

	return strconv.ParseFloat(value, 64)
}

func readLinuxThermalZoneTemperature() (float64, string, error) {
	paths, err := filepath.Glob("/sys/class/thermal/thermal_zone*/temp")
	if err != nil {
		return 0, "", err
	}

	var fallback thermalCandidate
	for _, path := range paths {
		candidate, err := thermalCandidateFromPath(path)
		if err != nil {
			continue
		}
		if fallback.path == "" {
			fallback = candidate
		}
		if candidate.isCPU {
			return candidate.tempC, candidate.source(), nil
		}
	}

	if fallback.path != "" {
		return fallback.tempC, fallback.source(), nil
	}

	return 0, "", errors.New("no thermal zone temperatures available")
}

func readLinuxHwmonTemperature() (float64, string, error) {
	paths, err := filepath.Glob("/sys/class/hwmon/hwmon*/temp*_input")
	if err != nil {
		return 0, "", err
	}

	var fallback thermalCandidate
	for _, path := range paths {
		candidate, err := thermalCandidateFromPath(path)
		if err != nil {
			continue
		}
		if fallback.path == "" {
			fallback = candidate
		}
		if candidate.isCPU {
			return candidate.tempC, candidate.source(), nil
		}
	}

	if fallback.path != "" {
		return fallback.tempC, fallback.source(), nil
	}

	return 0, "", errors.New("no hwmon temperatures available")
}

type thermalCandidate struct {
	path  string
	label string
	tempC float64
	isCPU bool
}

func thermalCandidateFromPath(path string) (thermalCandidate, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return thermalCandidate{}, err
	}

	temp, err := strconv.ParseFloat(strings.TrimSpace(string(raw)), 64)
	if err != nil {
		return thermalCandidate{}, err
	}
	if temp > 1000 {
		temp = temp / 1000
	}

	label := temperatureLabel(path)
	normalizedLabel := strings.ToLower(label)

	return thermalCandidate{
		path:  path,
		label: label,
		tempC: temp,
		isCPU: strings.Contains(normalizedLabel, "cpu") ||
			strings.Contains(normalizedLabel, "soc") ||
			strings.Contains(normalizedLabel, "package") ||
			strings.Contains(normalizedLabel, "x86_pkg"),
	}, nil
}

func temperatureLabel(path string) string {
	dir := filepath.Dir(path)
	labelPaths := []string{
		filepath.Join(dir, "type"),
		strings.TrimSuffix(path, "_input") + "_label",
		filepath.Join(dir, "name"),
	}

	for _, labelPath := range labelPaths {
		raw, err := os.ReadFile(labelPath)
		if err == nil {
			label := strings.TrimSpace(string(raw))
			if label != "" {
				return label
			}
		}
	}

	return filepath.Base(dir)
}

func (candidate thermalCandidate) source() string {
	if candidate.label == "" {
		return candidate.path
	}
	return candidate.label
}

func calculateWaterVaporPressure(tempCelsius float64) float64 {
	return math.Pow(10, 8.07131-(1730.63/(233.426+tempCelsius)))
}

func estimateWaterProductionRate(hotTempCelsius float64) float64 {
	const (
		coldTempCelsius = 25.0
		membraneCoeff   = 0.01
	)

	productionRate := membraneCoeff * (calculateWaterVaporPressure(hotTempCelsius) - calculateWaterVaporPressure(coldTempCelsius))
	if productionRate < 0 {
		return 0
	}
	return productionRate
}

func roundFloat(value float64, precision int) float64 {
	scale := math.Pow(10, float64(precision))
	return math.Round(value*scale) / scale
}
