//! # Network Prover
//!
//! This module provides an implementation of the [`crate::Prover`] trait that can generate proofs
//! on a remote RPC server.

use std::time::{Duration, Instant};

use crate::network::{
    DEFAULT_AUCTION_TIMEOUT_DURATION, NetworkMode,
    client::NetworkClient,
    proof::{ProofFromNetwork, SP1ProofMode},
    proto::{
        GetProofRequestStatusResponse,
        types::{ExecutionStatus, FulfillmentStatus, FulfillmentStrategy, ProofMode, ProofRequest},
    },
    signer::NetworkSigner,
};

use crate::network::proto::GetProofRequestParamsResponse;

use alloy_primitives::{Address, B256, U256};
use anyhow::{Result, anyhow, bail};
use sp1_core_executor::{Executor, Program};
use sp1_core_machine::io::SP1Stdin;
use sp1_prover::SP1_CIRCUIT_VERSION;
use sp1_prover::SP1VerifyingKey;

use sp1_stark::SP1CoreOpts;
use tokio::time::sleep;

/// An implementation of [`crate::ProverClient`] that can generate proofs on a remote RPC server.
pub struct NetworkProver {
    pub(crate) client: NetworkClient,
    pub(crate) network_mode: NetworkMode,
}

impl NetworkProver {
    /// Creates a new [`NetworkProver`] with the given signer and network mode.
    ///
    /// # Details
    /// * `signer`: The network signer to use for signing requests. Can be a `NetworkSigner`,
    ///   private key string, or anything that implements `Into<NetworkSigner>`.
    /// * `rpc_url`: The rpc url to use for the prover network.
    /// * `network_mode`: The network mode determining which proving strategy to use.
    ///
    /// # Examples
    /// Using a private key string:
    /// ```rust,no_run
    /// use sp1_sdk::{network::NetworkMode, NetworkProver};
    ///
    /// let prover = NetworkProver::new("0x...", "...", NetworkMode::Mainnet);
    /// ```
    ///
    /// Using a `NetworkSigner`:
    /// ```rust,no_run
    /// use sp1_sdk::{network::NetworkMode, NetworkProver, NetworkSigner};
    ///
    /// let signer = NetworkSigner::local("0x...").unwrap();
    /// let prover = NetworkProver::new(signer, "...", NetworkMode::Reserved);
    /// ```
    #[must_use]
    pub fn new(signer: impl Into<NetworkSigner>, rpc_url: &str, network_mode: NetworkMode) -> Self {
        // Install default CryptoProvider if not already installed.
        let _ = rustls::crypto::ring::default_provider().install_default();

        let signer = signer.into();
        let client = NetworkClient::new(signer, rpc_url, network_mode);
        Self {
            client,
            network_mode,
        }
    }

    /// Gets the network mode of this prover.
    pub fn network_mode(&self) -> NetworkMode {
        self.network_mode
    }

    /// Gets the default fulfillment strategy for this prover's network mode.
    pub fn default_fulfillment_strategy(&self) -> FulfillmentStrategy {
        match self.network_mode {
            NetworkMode::Mainnet => FulfillmentStrategy::Auction,
            NetworkMode::Reserved => FulfillmentStrategy::Hosted,
        }
    }

    /// Get the credit balance of your account on the prover network.
    ///
    /// # Example
    /// ```rust,no_run
    /// use sp1_sdk::{ProverClient, SP1Stdin};
    ///
    /// tokio_test::block_on(async {
    ///     let client = ProverClient::builder().network().build();
    ///     let balance = client.get_balance().await.unwrap();
    /// })
    /// ```
    pub async fn get_balance(&self) -> Result<U256> {
        self.client.get_balance().await
    }

    /// A request to generate a proof for a given verifying key, ELF and input.
    ///
    /// This allow to send proof requests to the network without having to run
    /// `setup()`. You just need the verifying key that is cheap to
    /// deserialize.
    ///
    /// # Details
    /// * `vk`: The verifying key to use for the proof.
    /// * `elf`: The ELF to use for the proof.
    /// * `stdin`: The input to use for the proof.
    ///
    /// # Example
    /// ```rust,no_run
    /// use sp1_sdk::{Prover, ProverClient, SP1Stdin};
    ///
    /// let elf = &[1, 2, 3];
    /// let vk_bytes = &[4, 5, 6];
    /// let stdin = SP1Stdin::new();
    ///
    /// let client = ProverClient::builder().network().build();
    /// let vk = bincode::deserialize(vk_bytes).unwrap();
    /// let proof = client.prove_from_vk(&vk, elf, &stdin).run();
    /// ```
    pub async fn request_proof<'a>(
        &'a self,
        vk: &'a SP1VerifyingKey,
        elf: &'a [u8],
        stdin: &'a SP1Stdin,
        mode: SP1ProofMode,
    ) -> Result<B256> {
        self.request_proof_impl(
            &vk,
            &elf,
            stdin,
            mode,
            self.default_fulfillment_strategy(),
            None,
            false,
            None,
            None,
            0,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
    }

    /// Registers a program if it is not already registered.
    ///
    /// # Details
    /// * `vk`: The verifying key to use for the program.
    /// * `elf`: The elf to use for the program.
    ///
    /// Note that this method requires that the user honestly registers the program (i.e., the elf
    /// matches the vk).
    ///
    /// # Example
    /// ```rust,no_run
    /// use sp1_sdk::{Prover, ProverClient, SP1Stdin};
    ///
    /// let elf = &[1, 2, 3];
    /// let client = ProverClient::builder().network().build();
    /// let (pk, vk) = client.setup(elf);
    ///
    /// let vk_hash = client.register_program(&vk, elf);
    /// ```
    pub async fn register_program(&self, vk: &SP1VerifyingKey, elf: &[u8]) -> Result<B256> {
        self.client.register_program(vk, elf).await
    }

    /// Gets the proof request parameters from the network.
    ///
    /// # Details
    /// * `mode`: The proof mode to get the parameters for.
    ///
    /// # Example
    /// ```rust,no_run
    /// use sp1_sdk::{ProverClient, SP1ProofMode};
    /// tokio_test::block_on(async {
    ///     let client = ProverClient::builder().network().build();
    ///     let params = client.get_proof_request_params(SP1ProofMode::Compressed).await.unwrap();
    /// })
    /// ```
    pub async fn get_proof_request_params(
        &self,
        mode: SP1ProofMode,
    ) -> Result<GetProofRequestParamsResponse> {
        match self.network_mode {
            NetworkMode::Mainnet => {
                let response = self.client.get_proof_request_params(mode.into()).await?;
                Ok(response)
            }
            NetworkMode::Reserved => Err(anyhow::anyhow!(
                "get_proof_request_params is only available in Mainnet mode (auction-based proving). This feature is not supported in Reserved mode."
            )),
        }
    }

    /// Gets the status of a proof request. Re-exposes the status response from the client.
    ///
    /// # Details
    /// * `request_id`: The request ID to get the status of.
    ///
    /// # Example
    /// ```rust,no_run
    /// use sp1_sdk::{network::B256, ProverClient};
    ///
    /// tokio_test::block_on(async {
    ///     let request_id = B256::from_slice(&vec![1u8; 32]);
    ///     let client = ProverClient::builder().network().build();
    ///     let (status, maybe_proof) = client.get_proof_status(request_id).await.unwrap();
    /// })
    /// ```
    pub async fn get_proof_status(
        &self,
        request_id: B256,
    ) -> Result<(GetProofRequestStatusResponse, Option<ProofFromNetwork>)> {
        let (status, maybe_proof): (GetProofRequestStatusResponse, Option<ProofFromNetwork>) = self
            .client
            .get_proof_request_status(request_id, None)
            .await?;
        Ok((status, maybe_proof))
    }

    /// Gets the proof request details, if available.
    ///
    /// The [`ProofRequest`] type contains useful information about the request, like the cycle
    /// count, or the gas used.
    ///
    /// # Details
    /// * `request_id`: The request ID to get the status of.
    ///
    /// # Example
    /// ```rust,no_run
    /// use sp1_sdk::{network::B256, ProverClient};
    ///
    /// tokio_test::block_on(async {
    ///     let request_id = B256::from_slice(&vec![1u8; 32]);
    ///     let client = ProverClient::builder().network().build();
    ///     let request = client.get_proof_request(request_id).await.unwrap();
    /// })
    /// ```
    pub async fn get_proof_request(&self, request_id: B256) -> Result<Option<ProofRequest>> {
        let res = self
            .client
            .get_proof_request_details(request_id, None)
            .await?;

        Ok(res.request)
    }

    /// Gets the status of a proof request with handling for timeouts and unfulfillable requests.
    ///
    /// Returns the proof if it is fulfilled and the fulfillment status. Handles statuses indicating
    /// that the proof is unfulfillable or unexecutable with errors.
    ///
    /// # Details
    /// * `request_id`: The request ID to get the status of.
    /// * `remaining_timeout`: The remaining timeout for the proof request.
    ///
    /// # Example
    /// ```rust,no_run
    /// use sp1_sdk::{network::B256, ProverClient};
    ///
    /// tokio_test::block_on(async {
    ///     let request_id = B256::from_slice(&vec![1u8; 32]);
    ///     let client = ProverClient::builder().network().build();
    ///     let (maybe_proof, fulfillment_status) =
    ///         client.process_proof_status(request_id, None).await.unwrap();
    /// })
    /// ```
    pub async fn process_proof_status(
        &self,
        request_id: B256,
        remaining_timeout: Option<Duration>,
    ) -> Result<(Option<ProofFromNetwork>, FulfillmentStatus)> {
        // Get the status.
        let (status, maybe_proof): (GetProofRequestStatusResponse, Option<ProofFromNetwork>) = self
            .client
            .get_proof_request_status(request_id, remaining_timeout)
            .await?;

        // Check if current time exceeds deadline. If so, the proof has timed out.
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        if current_time > status.deadline() {
            bail!("Request {request_id} timeout");
        }

        // Get the execution and fulfillment statuses.
        let execution_status = ExecutionStatus::try_from(status.execution_status()).unwrap();
        let fulfillment_status = FulfillmentStatus::try_from(status.fulfillment_status()).unwrap();

        // Check the execution status.
        if execution_status == ExecutionStatus::Unexecutable {
            bail!("Request {request_id} unexecutable");
        }

        // Check the fulfillment status.
        if fulfillment_status == FulfillmentStatus::Fulfilled {
            return Ok((maybe_proof, fulfillment_status));
        }
        if fulfillment_status == FulfillmentStatus::Unfulfillable {
            bail!("Request {request_id} unfulfillable");
        }

        Ok((None, fulfillment_status))
    }

    /// Requests a proof from the prover network, returning the request ID.
    ///
    /// # Details
    /// * `vk_hash`: The hash of the verifying key to use for the proof.
    /// * `stdin`: The input to use for the proof.
    /// * `mode`: The proof mode to use for the proof.
    /// * `strategy`: The fulfillment strategy to use for the proof.
    /// * `cycle_limit`: The cycle limit to use for the proof.
    /// * `gas_limit`: The gas limit to use for the proof.
    /// * `timeout`: The timeout for the proof request.
    /// * `min_auction_period`: The minimum auction period for the proof request in seconds.
    /// * `whitelist`: The auction whitelist for the proof request.
    /// * `auctioneer`: The auctioneer address for the proof request.
    /// * `executor`: The executor address for the proof request.
    /// * `verifier`: The verifier address for the proof request.
    /// * `treasury`: The treasury address for the proof request.
    /// * `public_values_hash`: The hash of the public values to use for the proof.
    /// * `base_fee`: The base fee to use for the proof request.
    /// * `max_price_per_pgu`: The maximum price per PGU to use for the proof request.
    /// * `domain`: The domain bytes to use for the proof request.
    #[allow(clippy::too_many_arguments)]
    pub(crate) async fn request_proof_internal(
        &self,
        vk_hash: B256,
        stdin: &SP1Stdin,
        mode: ProofMode,
        strategy: FulfillmentStrategy,
        cycle_limit: u64,
        gas_limit: u64,
        timeout: Option<Duration>,
        min_auction_period: u64,
        whitelist: Option<Vec<Address>>,
        auctioneer: Address,
        executor: Address,
        verifier: Address,
        treasury: Address,
        public_values_hash: Option<Vec<u8>>,
        base_fee: u64,
        max_price_per_pgu: u64,
        domain: Vec<u8>,
    ) -> Result<B256> {
        // Get the timeout. If no timeout is specified, auto-calculate based on gas limit for
        // Mainnet, use default timeout for Reserved.
        let timeout_secs = timeout.map_or_else(
            || match self.network_mode {
                NetworkMode::Mainnet => super::utils::calculate_timeout_from_gas_limit(gas_limit),
                NetworkMode::Reserved => super::DEFAULT_TIMEOUT_SECS,
            },
            |dur| dur.as_secs(),
        );

        let max_price_per_bpgu = max_price_per_pgu * 1_000_000_000;

        // Request the proof.
        let response = self
            .client
            .request_proof(
                vk_hash,
                stdin,
                mode,
                SP1_CIRCUIT_VERSION,
                strategy,
                timeout_secs,
                cycle_limit,
                gas_limit,
                min_auction_period,
                whitelist,
                auctioneer,
                executor,
                verifier,
                treasury,
                public_values_hash,
                base_fee,
                max_price_per_pgu,
                domain,
            )
            .await?;

        // Log the request ID and transaction hash.
        let tx_hash = B256::from_slice(response.tx_hash());
        let request_id = B256::from_slice(response.request_id());

        Ok(request_id)
    }

    /// Cancels a proof request by updating the deadline to the current time.
    /// Only available in Mainnet mode (auction-based proving).
    pub async fn cancel_request(&self, request_id: B256) -> Result<()> {
        match self.network_mode {
            NetworkMode::Mainnet => {
                self.client.cancel_request(request_id).await?;
                Ok(())
            }
            NetworkMode::Reserved => Err(anyhow::anyhow!(
                "cancel_request is only available in Mainnet mode (auction-based proving). This feature is not supported in Reserved mode."
            )),
        }
    }

    /// Waits for a proof to be generated and returns the proof. If a timeout is supplied, the
    /// function will return an error if the proof is not generated within the timeout.
    /// If `auction_timeout` is supplied, the function will return an error if the proof request
    /// remains in "requested" status for longer than the auction timeout.
    pub async fn wait_proof(
        &self,
        request_id: B256,
        timeout: Option<Duration>,
        auction_timeout: Option<Duration>,
    ) -> Result<ProofFromNetwork> {
        let mut is_assigned = false;
        let start_time = Instant::now();
        let mut requested_start_time: Option<Instant> = None;
        #[allow(unused)]
        let auction_timeout_duration = auction_timeout.unwrap_or(DEFAULT_AUCTION_TIMEOUT_DURATION);

        loop {
            // Calculate the remaining timeout.
            if let Some(timeout) = timeout {
                if start_time.elapsed() > timeout {
                    bail!("Request {request_id} timeout");
                }
            }
            let remaining_timeout = timeout.map(|t| {
                let elapsed = start_time.elapsed();
                t.checked_sub(elapsed).unwrap_or_default()
            });

            let (maybe_proof, fulfillment_status) = self
                .process_proof_status(request_id, remaining_timeout)
                .await?;

            if fulfillment_status == FulfillmentStatus::Fulfilled {
                return Ok(maybe_proof.unwrap());
            } else if fulfillment_status == FulfillmentStatus::Assigned && !is_assigned {
                is_assigned = true;
            } else if fulfillment_status == FulfillmentStatus::Requested {
                // Track when we first entered requested status.
                if requested_start_time.is_none() {
                    requested_start_time = Some(Instant::now());
                }

                // Check if we've exceeded the auction timeout (only for Mainnet mode).
                if self.network_mode == NetworkMode::Mainnet {
                    if let Some(req_start) = requested_start_time {
                        if req_start.elapsed() > auction_timeout_duration {
                            self.client.cancel_request(request_id).await?;
                            bail!("Request {request_id} auction timeout");
                        }
                    }
                }
            }

            sleep(Duration::from_secs(2)).await;
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) async fn request_proof_impl(
        &self,
        vk: &SP1VerifyingKey,
        elf: &[u8],
        stdin: &SP1Stdin,
        mode: SP1ProofMode,
        strategy: FulfillmentStrategy,
        timeout: Option<Duration>,
        skip_simulation: bool,
        cycle_limit: Option<u64>,
        gas_limit: Option<u64>,
        min_auction_period: u64,
        whitelist: Option<Vec<Address>>,
        auctioneer: Option<Address>,
        executor: Option<Address>,
        verifier: Option<Address>,
        treasury: Option<Address>,
        max_price_per_pgu: Option<u64>,
    ) -> Result<B256> {
        let vk_hash = self.register_program(vk, elf).await?;
        let (cycle_limit, gas_limit, public_values_hash) =
            self.get_execution_limits(cycle_limit, gas_limit, elf, stdin, skip_simulation)?;
        let (auctioneer, executor, verifier, treasury, max_price_per_pgu, base_fee, domain) = self
            .get_auction_request_params(
                mode.clone(),
                auctioneer,
                executor,
                verifier,
                treasury,
                max_price_per_pgu,
            )
            .await?;

        self.request_proof_internal(
            vk_hash,
            stdin,
            mode.into(),
            strategy,
            cycle_limit,
            gas_limit,
            timeout,
            min_auction_period,
            whitelist,
            auctioneer,
            executor,
            verifier,
            treasury,
            public_values_hash,
            base_fee,
            max_price_per_pgu,
            domain,
        )
        .await
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) async fn prove_impl(
        &self,
        vk: &SP1VerifyingKey,
        elf: &[u8],
        stdin: &SP1Stdin,
        mode: SP1ProofMode,
        strategy: FulfillmentStrategy,
        timeout: Option<Duration>,
        skip_simulation: bool,
        cycle_limit: Option<u64>,
        gas_limit: Option<u64>,
        tee_2fa: bool,
        min_auction_period: u64,
        whitelist: Option<Vec<Address>>,
        auctioneer: Option<Address>,
        executor: Option<Address>,
        verifier: Option<Address>,
        treasury: Option<Address>,
        max_price_per_pgu: Option<u64>,
        auction_timeout: Option<Duration>,
    ) -> Result<ProofFromNetwork> {
        #[allow(unused_mut)]
        let mut whitelist = whitelist.clone();

        // Attempt to get proof, with retry logic for failed auction requests.
        #[allow(clippy::never_loop)]
        loop {
            let request_id = self
                .request_proof_impl(
                    vk,
                    elf,
                    stdin,
                    mode,
                    strategy,
                    timeout,
                    skip_simulation,
                    cycle_limit,
                    gas_limit,
                    min_auction_period,
                    whitelist.clone(),
                    auctioneer,
                    executor,
                    verifier,
                    treasury,
                    max_price_per_pgu,
                )
                .await?;

            // Wait for the proof to be generated.
            let proof = self
                .wait_proof(request_id, timeout, auction_timeout)
                .await?;

            return Ok(proof);
        }
    }

    fn get_execution_limits(
        &self,
        cycle_limit: Option<u64>,
        gas_limit: Option<u64>,
        elf: &[u8],
        stdin: &SP1Stdin,
        skip_simulation: bool,
    ) -> Result<(u64, u64, Option<Vec<u8>>)> {
        let program = Program::from(elf).map_err(|err| anyhow!("{err}"))?;
        let mut runtime = Executor::new(program, SP1CoreOpts::default());
        runtime.write_vecs(&stdin.buffer);
        runtime.run_fast()?;
        Ok((runtime.state.global_clk, 0, None))
    }

    /// The proof request parameters for the auction strategy are determined according to the
    /// following priority:
    ///
    /// 1. If the parameter is explicitly set by the requester, use the specified value.
    /// 2. Otherwise, use the default values fetched from the network RPC.
    #[allow(unused_variables)]
    #[allow(clippy::unused_async)]
    async fn get_auction_request_params(
        &self,
        mode: SP1ProofMode,
        auctioneer: Option<Address>,
        executor: Option<Address>,
        verifier: Option<Address>,
        treasury: Option<Address>,
        max_price_per_pgu: Option<u64>,
    ) -> Result<(Address, Address, Address, Address, u64, u64, Vec<u8>)> {
        match self.network_mode {
            NetworkMode::Mainnet => {
                let params = self.get_proof_request_params(mode).await?;
                match params {
                    GetProofRequestParamsResponse::Auction(auction_params) => {
                        let auctioneer_value = if let Some(auctioneer) = auctioneer {
                            auctioneer
                        } else {
                            Address::from_slice(&auction_params.auctioneer)
                        };
                        let executor_value = if let Some(executor) = executor {
                            executor
                        } else {
                            Address::from_slice(&auction_params.executor)
                        };
                        let verifier_value = if let Some(verifier) = verifier {
                            verifier
                        } else {
                            Address::from_slice(&auction_params.verifier)
                        };
                        let treasury_value = if let Some(treasury) = treasury {
                            treasury
                        } else {
                            Address::from_slice(&auction_params.treasury)
                        };
                        let max_price_per_pgu_value =
                            if let Some(max_price_per_pgu) = max_price_per_pgu {
                                max_price_per_pgu
                            } else {
                                auction_params
                                    .max_price_per_pgu
                                    .parse::<u64>()
                                    .expect("invalid max_price_per_pgu")
                            };
                        let base_fee = auction_params
                            .base_fee
                            .parse::<u64>()
                            .expect("invalid base_fee");
                        Ok((
                            auctioneer_value,
                            executor_value,
                            verifier_value,
                            treasury_value,
                            max_price_per_pgu_value,
                            base_fee,
                            auction_params.domain,
                        ))
                    }
                    GetProofRequestParamsResponse::Unsupported => Err(anyhow::anyhow!(
                        "get_proof_request_params is not supported in {:?} mode. This operation is only available for Mainnet (auction-based proving).",
                        self.network_mode
                    )),
                }
            }
            NetworkMode::Reserved => {
                // Reserved mode doesn't use auction parameters.
                Ok((
                    Address::ZERO,
                    Address::ZERO,
                    Address::ZERO,
                    Address::ZERO,
                    0,
                    0,
                    vec![],
                ))
            }
        }
    }

    /// Formats a PROVE amount (with 18 decimals) as a string with 4 decimal places.
    fn format_prove_amount(amount: u64) -> String {
        let whole = amount / 1_000_000_000_000_000_000;
        let remainder = amount % 1_000_000_000_000_000_000;
        let frac = remainder / 100_000_000_000_000;
        format!("{whole}.{frac:04}")
    }
}

impl From<SP1ProofMode> for ProofMode {
    fn from(value: SP1ProofMode) -> Self {
        match value {
            SP1ProofMode::Core => Self::Core,
            SP1ProofMode::Compressed => Self::Compressed,
            SP1ProofMode::Plonk => Self::Plonk,
            SP1ProofMode::Groth16 => Self::Groth16,
        }
    }
}
