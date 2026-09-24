"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import type { MidnightWallet } from "midnight-wallet-kit";

export type { MidnightWallet };

const NETWORK = "preprod";
const SAVED_WALLET_KEY =
  "privateops:selected-wallet";

export type WalletOption = {
  name: string;
  installed: boolean;
  installUrl: string;
};

const WALLET_INSTALL_URLS: Record<
  string,
  string
> = {
  "1AM": "https://1am.xyz/",
  Nocturne:
    "https://github.com/Nocturne-Labs",
  NuFi: "https://wallet.nu.fi/",
  GeroWallet:
    "https://gerowallet.io/",
  VESPR:
    "https://www.vespr.xyz/",
  Yoroi:
    "https://www.yoroi-wallet.com/",
  Ctrl: "https://ctrl.xyz/",
  SubWallet:
    "https://www.subwallet.app/download",
};

const SUPPORTED_WALLETS =
  Object.keys(
    WALLET_INSTALL_URLS,
  );

type ConnectedAPIWithDisconnect =
  ConnectedAPI & {
    disconnect?: () => Promise<void>;
  };

export type MidnightWalletState = {
  wallet: MidnightWallet | null;
  connectedApi: ConnectedAPI | null;
  walletName: string | null;

  address: string | null;
  coinPublicKey: string | null;
  encryptionPublicKey: string | null;

  isConnected: boolean;
  isConnecting: boolean;

  error: string | null;

  walletOptions: WalletOption[];
  availableWallets: string[];

  detectWallets: () => Promise<void>;

  connect: (
    walletName: string,
  ) => Promise<void>;

  disconnect: () => Promise<void>;

  clearError: () => void;
};

export function useMidnight(): MidnightWalletState {
  const [wallet, setWallet] =
    useState<MidnightWallet | null>(
      null,
    );

  const [
    connectedApi,
    setConnectedApi,
  ] = useState<ConnectedAPI | null>(
    null,
  );

  const [walletName, setWalletName] =
    useState<string | null>(null);

  const [address, setAddress] =
    useState<string | null>(null);

  const [
    coinPublicKey,
    setCoinPublicKey,
  ] = useState<string | null>(null);

  const [
    encryptionPublicKey,
    setEncryptionPublicKey,
  ] = useState<string | null>(null);

  const [
    walletOptions,
    setWalletOptions,
  ] = useState<WalletOption[]>([]);

  const [
    isConnected,
    setIsConnected,
  ] = useState(false);

  const [
    isConnecting,
    setIsConnecting,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const autoReconnectAttempted =
    useRef(false);

  const detectWallets =
    useCallback(async () => {
      try {
        setError(null);

        const injectedWallets:
          InitialAPI[] =
          Object.values(
            window.midnight ?? {},
          );

        const detectedNames =
          injectedWallets
            .map(
              (item) => item.name,
            )
            .filter(
              (
                name,
              ): name is string =>
                Boolean(name),
            );

        const normalizedDetected =
          new Set(
            detectedNames.map(
              (name) =>
                name
                  .trim()
                  .toLowerCase(),
            ),
          );

        const options:
          WalletOption[] =
          SUPPORTED_WALLETS.map(
            (name) => ({
              name,
              installed:
                normalizedDetected.has(
                  name
                    .trim()
                    .toLowerCase(),
                ),
              installUrl:
                WALLET_INSTALL_URLS[
                  name
                ],
            }),
          );

        const knownWallets =
          new Set(
            SUPPORTED_WALLETS.map(
              (name) =>
                name
                  .trim()
                  .toLowerCase(),
            ),
          );

        for (
          const detectedName of
          detectedNames
        ) {
          const normalized =
            detectedName
              .trim()
              .toLowerCase();

          if (
            knownWallets.has(
              normalized,
            )
          ) {
            continue;
          }

          options.push({
            name: detectedName,
            installed: true,
            installUrl:
              "https://midnight.network/",
          });

          knownWallets.add(
            normalized,
          );
        }

        setWalletOptions(
          options,
        );
      } catch (err) {
        console.error(
          "PrivateOps wallet detection failed:",
          err,
        );

        setWalletOptions([]);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to detect Midnight-compatible wallets.",
        );
      }
    }, []);

  useEffect(() => {
    void detectWallets();

    const timer =
      window.setTimeout(
        () => {
          void detectWallets();
        },
        700,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [detectWallets]);

  const connect = useCallback(
    async (
      selectedWalletName: string,
    ) => {
      if (!selectedWalletName) {
        setError(
          "Please select a wallet.",
        );
        return;
      }

      setIsConnecting(true);
      setError(null);

      try {
        const injectedWallets:
          InitialAPI[] =
          Object.values(
            window.midnight ?? {},
          );

        const selectedWallet =
          injectedWallets.find(
            (item) =>
              item.name
                .trim()
                .toLowerCase() ===
              selectedWalletName
                .trim()
                .toLowerCase(),
          );

        if (!selectedWallet) {
          throw new Error(
            `${selectedWalletName} is not installed or is not available in this browser.`,
          );
        }

        /*
         * Connect directly through the official
         * Midnight DApp Connector API.
         */
        const api =
          await selectedWallet.connect(
            NETWORK,
          );

        if (!api) {
          throw new Error(
            "The selected wallet did not return a Midnight connection.",
          );
        }

        /*
         * Read the Midnight shielded address.
         */
        let walletAddress:
          | string
          | null = null;

        let shieldedCoinPublicKey:
          | string
          | null = null;

        let shieldedEncryptionPublicKey:
          | string
          | null = null;

        if (
          api.getShieldedAddresses
        ) {
          const shielded =
            await api.getShieldedAddresses();

          walletAddress =
            shielded.shieldedAddress;

          shieldedCoinPublicKey =
            shielded.shieldedCoinPublicKey;

          shieldedEncryptionPublicKey =
            shielded.shieldedEncryptionPublicKey;
        }

        /*
         * Fallback to unshielded address.
         */
        if (
          !walletAddress &&
          api.getUnshieldedAddress
        ) {
          const unshielded =
            await api.getUnshieldedAddress();

          walletAddress =
            unshielded.unshieldedAddress;
        }

        if (!walletAddress) {
          throw new Error(
            "Wallet connected, but no Midnight address was returned.",
          );
        }

        /*
         * UI wallet adapter.
         *
         * The actual ConnectedAPI remains
         * in connectedApi for transactions.
         */
        const uiWallet = {
          name:
            selectedWallet.name,

          connect:
            async () => {},

          disconnect:
            async () => {
              const disconnectWallet =
                (
                  api as
                    ConnectedAPIWithDisconnect
                ).disconnect;

              if (
                disconnectWallet
              ) {
                await disconnectWallet();
              }
            },

          isConnected:
            () => true,

          getAddress:
            () =>
              walletAddress ?? "",

          getCoinPublicKey:
            () =>
              shieldedCoinPublicKey,

          getEncryptionPublicKey:
            () =>
              shieldedEncryptionPublicKey,
        } as MidnightWallet;

        setWallet(uiWallet);

        setConnectedApi(api);

        setWalletName(
          selectedWallet.name,
        );

        setAddress(
          walletAddress,
        );

        setCoinPublicKey(
          shieldedCoinPublicKey,
        );

        setEncryptionPublicKey(
          shieldedEncryptionPublicKey,
        );

        setIsConnected(true);

        /*
         * Save only the wallet name.
         */
        window.localStorage.setItem(
          SAVED_WALLET_KEY,
          selectedWallet.name,
        );

        await detectWallets();
      } catch (err) {
        console.error(
          "PrivateOps wallet connection failed:",
          err,
        );

        setWallet(null);
        setConnectedApi(null);
        setWalletName(null);
        setAddress(null);
        setCoinPublicKey(null);
        setEncryptionPublicKey(
          null,
        );
        setIsConnected(false);

        if (
          err instanceof Error &&
          err.message.includes(
            "not installed or is not available",
          )
        ) {
          window.localStorage.removeItem(
            SAVED_WALLET_KEY,
          );
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to connect to the selected wallet.",
        );
      } finally {
        setIsConnecting(false);
      }
    },
    [detectWallets],
  );

  /*
   * Restore the previous wallet after
   * a page refresh.
   */
  useEffect(() => {
    if (
      autoReconnectAttempted.current
    ) {
      return;
    }

    autoReconnectAttempted.current =
      true;

    const savedWallet =
      window.localStorage.getItem(
        SAVED_WALLET_KEY,
      );

    if (!savedWallet) {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const maxAttempts = 30;

    const tryRestore =
      async () => {
        if (
          cancelled ||
          isConnected ||
          isConnecting
        ) {
          return;
        }

        attempts += 1;

        const injectedWallets =
          Object.values(
            window.midnight ?? {},
          );

        const walletExists =
          injectedWallets.some(
            (item) =>
              item.name
                .trim()
                .toLowerCase() ===
              savedWallet
                .trim()
                .toLowerCase(),
          );

        if (walletExists) {
          await connect(
            savedWallet,
          );
          return;
        }

        if (
          attempts < maxAttempts
        ) {
          window.setTimeout(
            () => {
              void tryRestore();
            },
            500,
          );
        } else {
          console.warn(
            `PrivateOps could not restore ${savedWallet}: wallet provider was not available.`,
          );
        }
      };

    const timer =
      window.setTimeout(
        () => {
          void tryRestore();
        },
        500,
      );

    return () => {
      cancelled = true;

      window.clearTimeout(
        timer,
      );
    };
  }, [
    connect,
    isConnected,
    isConnecting,
  ]);

  const disconnect =
    useCallback(
      async () => {
        try {
          const disconnectWallet =
            (
              connectedApi as
                | ConnectedAPIWithDisconnect
                | null
            )?.disconnect;

          if (
            disconnectWallet
          ) {
            await disconnectWallet();
          }
        } catch (err) {
          console.error(
            "PrivateOps wallet disconnect failed:",
            err,
          );
        } finally {
          setWallet(null);
          setConnectedApi(null);
          setWalletName(null);
          setAddress(null);
          setCoinPublicKey(null);
          setEncryptionPublicKey(
            null,
          );
          setIsConnected(false);
          setIsConnecting(false);
          setError(null);

          /*
           * Explicit disconnect means
           * do not auto-reconnect next time.
           */
          window.localStorage.removeItem(
            SAVED_WALLET_KEY,
          );

          await detectWallets();
        }
      },
      [
        connectedApi,
        detectWallets,
      ],
    );

  const clearError =
    useCallback(() => {
      setError(null);
    }, []);

  const availableWallets =
    walletOptions
      .filter(
        (item) =>
          item.installed,
      )
      .map(
        (item) =>
          item.name,
      );

  return {
    wallet,
    connectedApi,
    walletName,

    address,
    coinPublicKey,
    encryptionPublicKey,

    isConnected,
    isConnecting,

    error,

    walletOptions,
    availableWallets,

    detectWallets,
    connect,
    disconnect,
    clearError,
  };
}