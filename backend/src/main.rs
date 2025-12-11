use clap::Parser;
use tracing::{info, level_filters::LevelFilter};
use tracing_appender::rolling;
use tracing_subscriber::{
    EnvFilter, Layer, fmt::layer, layer::SubscriberExt, util::SubscriberInitExt,
};
use zcam1_server::build_app;

use crate::cli::Args;

mod cli;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().unwrap();

    let args = Args::parse();

    let app = build_app();

    let (file_layer, _guard) = if let Some(logs_path) = args.logs_path {
        // Create a rolling file appender
        let file_appender = rolling::never(logs_path, "logs.txt");

        // Create a layer that writes to the file
        let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

        let layer = layer()
            .compact()
            .with_target(false)
            .with_writer(non_blocking)
            .with_filter(LevelFilter::INFO);

        (Some(layer), Some(_guard))
    } else {
        (None, None)
    };

    tracing_subscriber::registry()
        .with(
            layer().compact().with_target(false).with_filter(
                EnvFilter::builder()
                    .with_default_directive(LevelFilter::INFO.into())
                    .from_env_lossy(),
            ),
        )
        .with(file_layer)
        .init();

    // run our app with hyper, listening globally on port 3000
    info!("Starting server on port {}", args.port);
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", args.port))
        .await
        .unwrap();
    axum::serve(listener, app).await.unwrap();
}
