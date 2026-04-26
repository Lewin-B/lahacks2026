# Stage 1: Build
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server .

# Stage 2: Minimal runtime image
FROM scratch

COPY --from=builder /app/server /server

EXPOSE 3000

ENTRYPOINT ["/server"]
