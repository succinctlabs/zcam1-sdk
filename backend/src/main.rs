use clap::Parser;
use zcam1_server::build_app;

use crate::cli::Args;

mod cli;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().unwrap();

    let args = Args::parse();

    let app = build_app();

    // run our app with hyper, listening globally on port 3000
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", args.port))
        .await
        .unwrap();
    axum::serve(listener, app).await.unwrap();
}
