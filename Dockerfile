FROM rust:1.91.1 AS builder

WORKDIR /usr/src/app

COPY Cargo.toml Cargo.lock ./
COPY backend ./backend
COPY crates ./crates
COPY programs ./programs

# Install SP1
RUN curl -L https://sp1.succinct.xyz | bash && \
    ~/.sp1/bin/sp1up -v v5.2.4 && \
    ~/.sp1/bin/cargo-prove prove --version


RUN cargo build --bin zcam1-server --release

FROM debian:trixie-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/zcam1-server /usr/local/bin/zcam1-server

EXPOSE 3001

CMD ["zcam1-server"]
