use axum_test::TestServer;
use serde_json::json;
use zcam1_server::build_app;

#[tokio::test(flavor = "multi_thread")]
async fn cert_chain_test() {
    let app = build_app();

    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/cert-chain")
        .json(&json!({
            "kty": "EC",
            "crv": "P-256",
            "x": "MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4",
            "y": "4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM",
        }))
        .await;

    response.assert_status_ok();

    println!("{}", response.text());
}
