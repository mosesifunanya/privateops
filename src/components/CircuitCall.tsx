"use client";

import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
} from "motion/react";
import { useEffect, useState } from "react";

import type { MidnightWallet } from "../hooks/useMidnight";
import { authorizeAction } from "../midnight/client";

interface CircuitCallProps {
  wallet: MidnightWallet | null;
  connectedApi: Parameters<typeof authorizeAction>[0] | null;
  address: string | null;
  actionAmount: string;
}

type ProofStatus =
  | "idle"
  | "proving"
  | "submitted"
  | "error";

type ToastType =
  | "wallet"
  | "amount"
  | null;

export default function CircuitCall({
  wallet,
  connectedApi,
  address,
  actionAmount,
}: CircuitCallProps) {
  const [status, setStatus] =
    useState<ProofStatus>("idle");

  const [transactionId, setTransactionId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [toast, setToast] =
    useState<ToastType>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const handleAuthorize = async () => {
    console.log(
      "PrivateOps: Prove authorization clicked",
    );

    console.log(
      "PrivateOps wallet:",
      wallet,
    );

    console.log(
      "PrivateOps connectedApi:",
      connectedApi,
    );

    console.log(
      "PrivateOps address:",
      address,
    );

    console.log(
      "PrivateOps action amount:",
      actionAmount,
    );

    /*
     * Wallet validation
     */
    if (!wallet || !connectedApi || !address) {
      setToast("wallet");
      setError(null);
      return;
    }

    /*
     * Amount validation
     */
    const trimmedAmount =
      actionAmount.trim();

    if (!trimmedAmount) {
      setToast("amount");
      setError(null);
      return;
    }

    if (!/^\d+$/.test(trimmedAmount)) {
      setToast(null);
      setError(
        "Enter a valid whole number.",
      );
      setStatus("error");
      return;
    }

    const amount = BigInt(trimmedAmount);

    if (amount <= 0n) {
      setToast(null);
      setError(
        "Action amount must be greater than 0.",
      );
      setStatus("error");
      return;
    }

    setToast(null);
    setStatus("proving");
    setError(null);
    setTransactionId(null);

    try {
      /*
       * The public action amount is passed to
       * the authorization circuit.
       *
       * The private policy remains inside the
       * Midnight private state/witness.
       */
      const result = await authorizeAction(
        connectedApi,
        address,
        amount,
      );

      const nextTransactionId =
        extractTransactionId(result);

      setTransactionId(
        nextTransactionId,
      );

      setStatus("submitted");
    } catch (err) {
      console.error(
        "PrivateOps authorization failed:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Authorization proof failed.",
      );

      setStatus("error");
    }
  };

  return (
    <>
      <div className="space-y-4">
        <motion.button
          type="button"
          disabled={status === "proving"}
          onClick={handleAuthorize}
          whileHover={
            status === "proving"
              ? undefined
              : {
                  y: -2,
                }
          }
          whileTap={
            status === "proving"
              ? undefined
              : {
                  scale: 0.985,
                }
          }
          className="proof-button"
        >
          {status === "proving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "submitted" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}

          {status === "proving"
            ? "Generating proof..."
            : status === "submitted"
              ? "Authorization proved"
              : "Prove authorization"}

          {status !== "proving" && (
            <ArrowRight className="h-4 w-4" />
          )}
        </motion.button>

        {status === "proving" && (
          <motion.div
            initial={{
              opacity: 0,
              y: 6,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-[#84cc16]/10 p-2 text-[#84cc16]">
                <ShieldCheck className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Proved without revealing your input
                </p>

                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Your private policy is being used
                  locally to generate the
                  zero-knowledge proof.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {status === "submitted" && (
          <motion.div
            initial={{
              opacity: 0,
              y: 6,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="rounded-2xl border border-[#84cc16]/30 bg-[#84cc16]/5 p-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#84cc16]" />

              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Authorization submitted
                </p>

                <p className="mt-1 break-all text-xs text-[var(--muted)]">
                  Transaction:{" "}
                  {transactionId ?? "Submitted"}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {status === "error" && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-red-500 dark:text-red-300">
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Right-side notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{
              opacity: 0,
              x: 45,
              y: 20,
            }}
            animate={{
              opacity: 1,
              x: 0,
              y: 0,
            }}
            exit={{
              opacity: 0,
              x: 45,
              y: 20,
            }}
            transition={{
              duration: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
         className="fixed bottom-3 right-2 z-[9999] w-[min(440px,calc(100vw-2rem))] sm:bottom-4 sm:right-3 lg:right-4 xl:right-5"
          >
            <div className="w-full overflow-hidden rounded-2xl border border-[#84cc16]/30 bg-[var(--surface)] shadow-[0_20px_55px_var(--shadow)]">
              <div className="flex items-start gap-3 p-4 sm:p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#84cc16]/25 bg-[#84cc16]/10 text-[#84cc16]">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#84cc16]">
                    {toast === "wallet"
                      ? "Connect wallet"
                      : "Enter amount"}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    {toast === "wallet"
                      ? "Connect a Midnight wallet before proving this authorization."
                      : "Enter the public action amount you want to authorize."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition-all duration-200 hover:bg-[#84cc16]/10 hover:text-[#84cc16]"
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="h-0.5 w-full bg-[var(--border)]">
                <motion.div
                  initial={{
                    width: "100%",
                  }}
                  animate={{
                    width: "0%",
                  }}
                  transition={{
                    duration: 4.5,
                    ease: "linear",
                  }}
                  className="h-full bg-[#84cc16]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function extractTransactionId(
  result: unknown,
): string | null {
  if (typeof result === "string") {
    return result;
  }

  if (
    result &&
    typeof result === "object"
  ) {
    const value =
      result as Record<string, unknown>;

    for (const key of [
      "transactionId",
      "txId",
      "txHash",
      "hash",
    ]) {
      if (
        typeof value[key] === "string"
      ) {
        return value[key];
      }
    }
  }

  return null;
}