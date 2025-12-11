use clap::Parser;

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
pub struct Args {
    #[clap(long, env, default_value_t = 8081)]
    pub port: u16,

    #[clap(long, env)]
    pub logs_path: Option<String>,
}
