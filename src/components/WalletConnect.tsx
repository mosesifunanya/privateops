"use client";

import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  useEffect,
  useState,
} from "react";

import { createPortal } from "react-dom";

import type { MidnightWalletState } from "../hooks/useMidnight";
import { useAppTheme } from "../../app/providers";

const WALLET_COLORS: Record<
  string,
  string
> = {
  "1AM": "#84cc16",
  Nocturne: "#8b5cf6",
  NuFi: "#38bdf8",
  GeroWallet: "#f59e0b",
  VESPR: "#06b6d4",
  Yoroi: "#f97316",
  Ctrl: "#a855f7",
  SubWallet: "#22c55e",
};

interface WalletConnectProps {
  midnight: MidnightWalletState;
}

export default function WalletConnect({
  midnight,
}: WalletConnectProps) {
  const { theme } = useAppTheme();
  const isDark = theme === "dark";

  const {
    wallet,
    walletName,
    address,
    isConnected,
    isConnecting,
    error,
    walletOptions,
    detectWallets,
    connect,
    disconnect,
    clearError,
  } = midnight;

  const [open, setOpen] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [
    selectedWallet,
    setSelectedWallet,
  ] = useState<string | null>(
    null,
  );

  const [portalReady, setPortalReady] =
    useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const handleOpen = async () => {
    clearError();
    setOpen(true);

    await detectWallets();
  };

  const handleClose = () => {
    if (isConnecting) {
      return;
    }

    clearError();
    setOpen(false);
  };

  const handleWalletClick =
    async (
      name: string,
      installed: boolean,
      installUrl: string,
    ) => {
      clearError();

      if (!installed) {
        window.location.assign(
          installUrl,
        );

        return;
      }

      setSelectedWallet(name);

      await connect(name);
    };

  useEffect(() => {
    if (
      isConnected &&
      !isConnecting
    ) {
      setOpen(false);
    }
  }, [
    isConnected,
    isConnecting,
  ]);

  const handleDisconnect =
    async () => {
      await disconnect();

      setSelectedWallet(null);
      setCopied(false);
    };

  const handleCopy = async () => {
    if (!address) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        address,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setCopied(false);
    }
  };

  const shortenedAddress =
    address
      ? `${address.slice(
          0,
          8,
        )}...${address.slice(-6)}`
      : null;

  if (
    isConnected &&
    address
  ) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2 rounded-full border border-[#84cc16]/25 bg-[var(--surface)] px-3 py-2 shadow-[0_0_25px_rgba(132,204,22,0.06)]">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[#84cc16]/10 text-[#84cc16]">
            <ShieldCheck className="h-3.5 w-3.5" />

            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#84cc16]" />
          </span>

          <div className="hidden sm:block">
            <p className="max-w-[130px] truncate text-xs font-semibold text-[var(--foreground)]">
              {walletName ||
                wallet?.name ||
                "Wallet connected"}
            </p>

            <p className="max-w-[130px] truncate font-mono text-[9px] text-slate-500">
              {shortenedAddress}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="hidden rounded-full p-1.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-white sm:block"
            title="Copy wallet address"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[#84cc16]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={
              handleDisconnect
            }
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-red-400/[0.08] hover:text-red-400"
            title="Disconnect wallet"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const walletModal =
    open && portalReady
      ? createPortal(
          <AnimatePresence>
            <motion.div
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              className={`fixed inset-0 z-[99999] flex min-h-screen items-center justify-center overflow-y-auto p-4 backdrop-blur-xl ${isDark ? "bg-[#02050a]/85" : "bg-slate-900/30"}`}
              onMouseDown={
                handleClose
              }
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#84cc16]/[0.04] blur-[120px]" />

                <div className="absolute left-[15%] top-[10%] h-[220px] w-[220px] rounded-full bg-cyan-500/[0.025] blur-[100px]" />
              </div>

              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.94,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.94,
                  y: 20,
                }}
                transition={{
                  duration: 0.22,
                  ease: [
                    0.22,
                    1,
                    0.36,
                    1,
                  ],
                }}
                onMouseDown={(
                  event,
                ) =>
                  event.stopPropagation()
                }
                className={`relative my-auto w-full max-w-[720px] overflow-hidden rounded-[30px] border shadow-[0_30px_100px_rgba(0,0,0,0.18)] ${isDark ? "border-white/[0.10] bg-[linear-gradient(145deg,#0b1220_0%,#070c15_48%,#050910_100%)] shadow-[0_40px_140px_rgba(0,0,0,0.8)]" : "border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.18)]"}`}
              >
                <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[70%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#84cc16]/70 to-transparent" />

                {/* HEADER */}

                <div className={`relative border-b px-5 py-5 sm:px-6 ${isDark ? "border-white/[0.07]" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#84cc16]/25 bg-gradient-to-br from-[#84cc16]/15 to-cyan-400/[0.05] text-[#84cc16]">
                        <Wallet className="h-5 w-5" />

                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0b1220] bg-[#84cc16]" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className={`text-base font-semibold tracking-tight sm:text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
                            Connect a wallet
                          </h2>

                          <span className="rounded-full border border-[#84cc16]/20 bg-[#84cc16]/[0.07] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[#84cc16]">
                            Preprod
                          </span>
                        </div>

                        <p className={`mt-1 text-[11px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                          Choose a Midnight-compatible wallet
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        handleClose
                      }
                      disabled={
                        isConnecting
                      }
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-slate-500 transition disabled:opacity-40 ${isDark ? "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* BODY */}

                <div className="relative max-h-[calc(100vh-180px)] overflow-y-auto p-5 sm:p-6">
                  {error && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: -5,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold text-red-300">
                            Wallet connection issue
                          </p>

                          <p className="mt-1 text-[11px] leading-5 text-red-300/75">
                            {error}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={
                            clearError
                          }
                          className="rounded-lg p-1 text-red-400 hover:bg-red-400/10"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="mb-4 flex items-end justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Wallets
                      </p>

                      <p className={`mt-1 text-[11px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                        Installed wallets connect directly. Others open their official installation page.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        detectWallets
                      }
                      disabled={
                        isConnecting
                      }
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-slate-500 transition disabled:opacity-40 ${isDark ? "border-white/[0.08] bg-white/[0.025] hover:border-[#84cc16]/25 hover:bg-[#84cc16]/[0.05] hover:text-[#84cc16]" : "border-slate-200 bg-slate-50 hover:border-[#84cc16]/35 hover:bg-[#84cc16]/[0.06] hover:text-[#166534]"}`}
                      title="Scan for wallets"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${
                          isConnecting
                            ? "animate-spin"
                            : ""
                        }`}
                      />
                    </button>
                  </div>

                  {walletOptions.length >
                  0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {walletOptions.map(
                        (
                          walletOption,
                        ) => {
                          const accent =
                            WALLET_COLORS[
                              walletOption
                                .name
                            ] ??
                            "#84cc16";

                          const isSelected =
                            selectedWallet ===
                              walletOption.name &&
                            isConnecting;

                          return (
                            <motion.button
                              key={
                                walletOption.name
                              }
                              type="button"
                              disabled={
                                isConnecting
                              }
                              onClick={() =>
                                handleWalletClick(
                                  walletOption.name,
                                  walletOption.installed,
                                  walletOption.installUrl,
                                )
                              }
                              whileHover={{
                                y: -2,
                              }}
                              whileTap={{
                                scale: 0.985,
                              }}
                              className={`group relative overflow-hidden rounded-2xl border p-3.5 text-left transition ${
                                walletOption.installed
                                  ? "border-[#84cc16]/15 bg-[#84cc16]/[0.025] hover:border-[#84cc16]/35 hover:bg-[#84cc16]/[0.055]"
                                  : isDark ? "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              <div
                                className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-[0.08] blur-2xl"
                                style={{
                                  backgroundColor:
                                    accent,
                                }}
                              />

                              <div className="relative">
                                <div className="flex items-start gap-3">
                                  <div
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                                    style={{
                                      borderColor:
                                        `${accent}35`,
                                      backgroundColor:
                                        `${accent}0d`,
                                    }}
                                  >
                                    {isSelected ? (
                                      <Loader2
                                        className="h-5 w-5 animate-spin"
                                        style={{
                                          color:
                                            accent,
                                        }}
                                      />
                                    ) : (
                                      <Wallet
                                        className="h-5 w-5"
                                        style={{
                                          color:
                                            accent,
                                        }}
                                      />
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className={`truncate text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                        {
                                          walletOption.name
                                        }
                                      </p>

                                      <span
                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${
                                          walletOption.installed
                                            ? "border border-[#84cc16]/20 bg-[#84cc16]/[0.07] text-[#84cc16]"
                                            : isDark ? "border border-white/[0.08] bg-white/[0.035] text-slate-500" : "border border-slate-200 bg-slate-100 text-slate-500"
                                        }`}
                                      >
                                        {walletOption.installed
                                          ? "Detected"
                                          : "Not installed"}
                                      </span>
                                    </div>

                                    <p className={`mt-1 flex items-center gap-1.5 text-[9px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                      {walletOption.installed ? (
                                        <>
                                          <ShieldCheck className="h-3 w-3 text-[#84cc16]" />
                                          Ready to connect
                                        </>
                                      ) : (
                                        <>
                                          <Smartphone className="h-3 w-3" />
                                          Official download
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div
                                  className={`mt-3 flex h-9 items-center justify-center gap-2 rounded-xl text-[10px] font-bold transition ${
                                    walletOption.installed
                                      ? "bg-[#84cc16] text-[#081006] hover:bg-[#a3e635]"
                                      : isDark ? "border border-white/[0.08] bg-white/[0.025] text-slate-300 hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                                  }`}
                                >
                                  {isSelected ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Connecting...
                                    </>
                                  ) : walletOption.installed ? (
                                    <>
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      Connect
                                    </>
                                  ) : (
                                    <>
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      Get wallet
                                    </>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div className={`rounded-2xl border p-8 text-center ${isDark ? "border-white/[0.08] bg-white/[0.025]" : "border-slate-200 bg-slate-50"}`}>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#84cc16]/15 bg-[#84cc16]/[0.05] text-[#84cc16]">
                        <Wallet className="h-6 w-6" />
                      </div>

                      <p className="mt-4 text-sm font-semibold text-white">
                        Scanning for wallets
                      </p>

                      <p className={`mx-auto mt-2 max-w-[320px] text-[11px] leading-5 ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                        PrivateOps is checking the Midnight wallet providers available in this browser.
                      </p>

                      <button
                        type="button"
                        onClick={
                          detectWallets
                        }
                        className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl border border-[#84cc16]/25 bg-[#84cc16]/[0.08] px-4 text-[10px] font-semibold text-[#84cc16] hover:bg-[#84cc16]/[0.14]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Scan again
                      </button>
                    </div>
                  )}

                  <div className={`mt-5 flex items-start gap-3 rounded-2xl border p-3.5 ${isDark ? "border-white/[0.06] bg-gradient-to-r from-white/[0.025] to-[#84cc16]/[0.025]" : "border-slate-200 bg-gradient-to-r from-slate-50 to-[#84cc16]/[0.05]"}`}>
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#84cc16]/[0.07] text-[#84cc16]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>

                    <div>
                      <p className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        Automatic wallet detection
                      </p>

                      <p className={`mt-1 text-[9px] leading-4 ${isDark ? "text-slate-600" : "text-slate-500"}`}>
                        Detected wallets open their connection flow directly. Wallets that are unavailable can be installed from their official page.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={isConnecting}
        className="flex items-center gap-2 rounded-full border border-[#84cc16]/30 bg-[#84cc16]/10 px-4 py-2.5 text-xs font-semibold text-[#84cc16] shadow-[0_0_25px_rgba(132,204,22,0.04)] transition hover:border-[#84cc16]/60 hover:bg-[#84cc16]/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}

        {isConnecting
          ? "Connecting..."
          : "Connect Wallet"}
      </button>

      {walletModal}
    </>
  );
}