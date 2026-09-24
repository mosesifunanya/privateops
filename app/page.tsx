'use client';

import {
  ArrowRight,
  Check,
  CircleCheck,
  Github,
  Linkedin,
  Mail,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useAppTheme } from './providers';

import WalletConnect from '../src/components/WalletConnect';

const CircuitCall = dynamic(
  () => import('../src/components/CircuitCall'),
  { ssr: false },
);

import { useMidnight } from '../src/hooks/useMidnight';
import type { MidnightWalletState } from '../src/hooks/useMidnight';

export default function Home() {
  const { theme, toggleTheme } = useAppTheme();
  const shouldReduceMotion = useReducedMotion();
  const midnight = useMidnight();
  const { wallet, connectedApi, address } = midnight;

  const isDark = theme === 'dark';

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <AmbientBackground />

      <Header
        isDark={isDark}
        toggleTheme={toggleTheme}
        midnight={midnight}
      />

      <Hero
        shouldReduceMotion={shouldReduceMotion}
      />

      <HowItWorks
        shouldReduceMotion={shouldReduceMotion}
      />

      <Authorization
        shouldReduceMotion={shouldReduceMotion}
        wallet={wallet}
        connectedApi={connectedApi}
        address={address}
      />

      <Privacy />

      <Contact
        shouldReduceMotion={shouldReduceMotion}
      />

      <Footer />
    </main>
  );
}

function AmbientBackground() {
  return (
    <div className="ambient-background">
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="technical-grid" />
    </div>
  );
}

function Header({
  isDark,
  toggleTheme,
  midnight,
}: {
  isDark: boolean;
  toggleTheme: () => void;
  midnight: MidnightWalletState;
}) {
  const [hideOnScroll, setHideOnScroll] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const updateHeader = () => {
      const currentScrollY = window.scrollY;
      const previousScrollY = lastScrollY.current;

      if (currentScrollY <= 8) {
        setHideOnScroll(false);
      } else if (currentScrollY > previousScrollY + 6) {
        setHideOnScroll(true);
      } else if (currentScrollY < previousScrollY - 6) {
        setHideOnScroll(false);
      }

      lastScrollY.current = currentScrollY;
      ticking.current = false;
    };

    const handleScroll = () => {
      if (ticking.current) return;

      ticking.current = true;
      window.requestAnimationFrame(updateHeader);
    };

    window.addEventListener('scroll', handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header
      className={`site-header${
        hideOnScroll
          ? ' site-header--hidden-mobile'
          : ''
      }`}
      style={{
        backgroundColor:
          'var(--background)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <motion.a
          href="#"
          initial={{
            opacity: 0,
            x: -8,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: 0.45,
          }}
          className="brand group"
        >
          <span className="brand-icon">
            <ShieldCheck className="h-[17px] w-[17px]" />
          </span>

          <span>
            <span className="block text-sm font-bold tracking-tight">
              PrivateOps
            </span>

            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] sm:block">
              Privacy infrastructure
            </span>
          </span>
        </motion.a>

        <nav className="hidden items-center gap-4 md:flex lg:gap-8">
          <NavLink href="#how-it-works">
            How it works
          </NavLink>

          <NavLink href="#privacy">
            Privacy
          </NavLink>

          <NavLink href="#authorize">
            Authorize
          </NavLink>

          <NavLink href="#contact">
            Contact Us
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileHover={{
              scale: 1.04,
            }}
            whileTap={{
              scale: 0.94,
            }}
            onClick={toggleTheme}
            className="icon-button"
            aria-label={
              isDark
                ? 'Switch to light mode'
                : 'Switch to dark mode'
            }
          >
            <AnimatePresence
              mode="wait"
              initial={false}
            >
              <motion.span
                key={isDark ? 'sun' : 'moon'}
                initial={{
                  opacity: 0,
                  rotate: -35,
                  scale: 0.7,
                }}
                animate={{
                  opacity: 1,
                  rotate: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  rotate: 35,
                  scale: 0.7,
                }}
                transition={{
                  duration: 0.22,
                  ease: 'easeOut',
                }}
              >
                {isDark ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>

          <WalletConnect midnight={midnight} />
        </div>
      </div>

      <nav className="flex items-center gap-4 overflow-x-auto border-t border-[var(--border)] bg-[var(--background)] px-4 py-2 md:hidden">
        <NavLink href="#how-it-works">
          How it works
        </NavLink>

        <NavLink href="#privacy">
          Privacy
        </NavLink>

        <NavLink href="#authorize">
          Authorize
        </NavLink>

        <NavLink href="#contact">
          Contact Us
        </NavLink>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <motion.a
      href={href}
      whileHover={{
        y: -2,
      }}
      whileTap={{
        scale: 0.96,
      }}
      transition={{
        duration: 0.18,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-[var(--muted)] transition-all duration-200 hover:bg-[#84cc16] hover:text-white hover:shadow-[0_8px_22px_rgba(132,204,22,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
    >
      <span className="relative z-10">
        {children}
      </span>
    </motion.a>
  );
}

function Hero({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null;
}) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 sm:pb-28 sm:pt-28 lg:px-8 lg:pb-32 lg:pt-28">
        <div className="max-w-4xl">
          <motion.div
            initial={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
            }}
            className="status-pill"
          >
            <span className="status-dot" />

            Midnight Network

            <span className="status-divider" />

            Preprod
          </motion.div>

          <motion.h1
            initial={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.7,
              delay: 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="hero-title"
          >
            Verify AI actions.

            <span>
              Keep the rules private.
            </span>
          </motion.h1>

          <motion.p
            initial={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 14,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.6,
              delay: 0.13,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="hero-copy"
          >
            PrivateOps lets AI agents prove that a
            sensitive action follows a private policy
            without exposing the policy itself.
          </motion.p>

          <motion.div
            initial={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.55,
              delay: 0.2,
            }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <motion.a
              href="#authorize"
              whileHover={{
                y: -2,
              }}
              whileTap={{
                scale: 0.985,
              }}
              className="primary-button h-11 justify-center px-5"
            >
              Try authorization

              <ArrowRight className="h-4 w-4" />
            </motion.a>

            <motion.a
              href="#privacy"
              whileHover={{
                y: -2,
              }}
              whileTap={{
                scale: 0.985,
              }}
              className="secondary-button h-11 justify-center px-5"
            >
              Explore privacy
            </motion.a>
          </motion.div>
        </div>

        <motion.div
          initial={{
            opacity: 0,
            y: shouldReduceMotion ? 0 : 24,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.75,
            delay: 0.28,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mt-16 sm:mt-20"
        >
          <ProofPanel
            shouldReduceMotion={shouldReduceMotion}
          />
        </motion.div>
      </div>
    </section>
  );
}

function ProofPanel({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null;
}) {
  return (
    <motion.div
      className="proof-shell"
      whileHover={
        shouldReduceMotion
          ? undefined
          : {
              y: -2,
            }
      }
      transition={{
        duration: 0.3,
        ease: 'easeOut',
      }}
    >
      <div className="proof-topbar">
        <div className="flex items-center gap-2">
          <motion.span
            className="live-indicator"
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: [0.55, 1, 0.55],
                    scale: [1, 1.12, 1],
                  }
            }
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <span className="mono-label">
            AUTHORIZATION PROOF
          </span>
        </div>

        <span className="network-badge">
          PREPROD
        </span>
      </div>

      <div className="grid md:grid-cols-[1fr_auto_1fr]">
        <ProofNode
          label="Private policy"
          value="Hidden"
          icon={
            <LockKeyhole className="h-4 w-4" />
          }
          privateValue
        />

        <div className="proof-connector">
          <span className="connector-line" />

          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    scale: [1, 1.08, 1],
                    opacity: [0.7, 1, 0.7],
                  }
            }
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="proof-core"
          >
            <Sparkles className="h-4 w-4" />
          </motion.div>

          <span className="connector-line" />
        </div>

        <ProofNode
          label="Public result"
          value="Authorized"
          icon={
            <Check className="h-4 w-4" />
          }
          success
        />
      </div>

      <div className="proof-bottom">
        <div>
          <span className="mono-label">
            ACTION
          </span>

          <motion.strong
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              delay: 0.7,
            }}
          >
            $300
          </motion.strong>
        </div>

        <div className="hidden h-7 w-px bg-[var(--border)] sm:block" />

        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <CircleCheck className="h-4 w-4 text-[var(--accent)]" />

          Proved without revealing your input
        </div>
      </div>
    </motion.div>
  );
}

function ProofNode({
  label,
  value,
  icon,
  privateValue,
  success,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  privateValue?: boolean;
  success?: boolean;
}) {
  return (
    <motion.div
      whileHover={{
        backgroundColor:
          'var(--accent-soft)',
      }}
      transition={{
        duration: 0.25,
      }}
      className="proof-node"
    >
      <div className="flex items-center gap-2 text-[var(--muted)]">
        {icon}

        <span className="text-xs font-medium">
          {label}
        </span>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <motion.div
          whileHover={{
            scale: 1.04,
          }}
          className={
            success
              ? 'result-icon'
              : 'private-icon'
          }
        >
          {privateValue ? (
            <LockKeyhole className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </motion.div>

        <span className="text-xl font-semibold tracking-tight">
          {value}
        </span>
      </div>
    </motion.div>
  );
}

function HowItWorks({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null;
}) {
  return (
    <section
      id="how-it-works"
      className="section-divider"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="Proof without exposure."
          description="Sensitive policy data stays private while the result remains independently verifiable."
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{
            once: true,
            amount: 0.2,
          }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: shouldReduceMotion
                  ? 0
                  : 0.08,
              },
            },
          }}
          className="mt-10 grid gap-4 md:grid-cols-3"
        >
          <FeatureCard
            number="01"
            icon={
              <LockKeyhole className="h-4 w-4" />
            }
            title="Private policy"
            description="The policy limit is supplied as private witness data."
          />

          <FeatureCard
            number="02"
            icon={
              <Sparkles className="h-4 w-4" />
            }
            title="Local proof"
            description="The authorization condition is proven without exposing the policy."
          />

          <FeatureCard
            number="03"
            icon={
              <CircleCheck className="h-4 w-4" />
            }
            title="Public result"
            description="Only deliberately disclosed information becomes public."
          />
        </motion.div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="eyebrow">
        {eyebrow}
      </div>

      <h2 className="section-title mt-3">
        {title}
      </h2>

      <p className="section-copy mt-3">
        {description}
      </p>
    </div>
  );
}

function FeatureCard({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: {
          opacity: 0,
          y: 18,
        },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      }}
      whileHover={{
        y: -4,
      }}
      className="feature-card"
    >
      <div className="flex items-center justify-between">
        <span className="number-label">
          {number}
        </span>

        <span className="feature-icon">
          {icon}
        </span>
      </div>

      <h3 className="mt-12 text-base font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </motion.div>
  );
}

function Authorization({
  shouldReduceMotion,
  wallet,
  connectedApi,
  address,
}: {
  shouldReduceMotion: boolean | null;
  wallet: ReturnType<typeof useMidnight>['wallet'];
  connectedApi: ReturnType<typeof useMidnight>['connectedApi'];
  address: ReturnType<typeof useMidnight>['address'];
}) {
  return (
    <section
      id="authorize"
      className="scroll-mt-24"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <motion.div
            initial={{
              opacity: 0,
              x: shouldReduceMotion ? 0 : -15,
            }}
            whileInView={{
              opacity: 1,
              x: 0,
            }}
            viewport={{
              once: true,
              amount: 0.25,
            }}
            transition={{
              duration: 0.6,
            }}
          >
            <div className="eyebrow">
              Authorization
            </div>

            <h2 className="section-title">
              Let the proof speak.
            </h2>

            <p className="section-copy">
              Submit an action for verification while
              keeping the policy that governs it private.
            </p>

            <div className="mt-7 space-y-3">
              <InfoTile
                icon={
                  <LockKeyhole className="h-4 w-4" />
                }
                title="Private witness"
                description="Policy data stays outside the public interface."
              />

              <InfoTile
                icon={
                  <Zap className="h-4 w-4" />
                }
                title="Selective disclosure"
                description="Only the action and authorization result are revealed."
              />
            </div>
          </motion.div>

          <AuthorizationCard
            shouldReduceMotion={
              shouldReduceMotion
            }
            wallet={wallet}
            connectedApi={connectedApi}
            address={address}
          />
        </div>
      </div>
    </section>
  );
}

function InfoTile({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      whileHover={{
        x: 3,
      }}
      className="info-tile"
    >
      <span className="feature-icon">
        {icon}
      </span>

      <div>
        <div className="text-sm font-semibold">
          {title}
        </div>

        <div className="mt-1 text-xs leading-5 text-[var(--muted)]">
          {description}
        </div>
      </div>
    </motion.div>
  );
}

function AuthorizationCard({
  shouldReduceMotion,
  wallet,
  connectedApi,
  address,
}: {
  shouldReduceMotion: boolean | null;
  wallet: ReturnType<typeof useMidnight>['wallet'];
  connectedApi: ReturnType<typeof useMidnight>['connectedApi'];
  address: ReturnType<typeof useMidnight>['address'];
}) {
  const [actionAmount, setActionAmount] =
    useState('');

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: shouldReduceMotion ? 0 : 15,
      }}
      whileInView={{
        opacity: 1,
        x: 0,
      }}
      viewport={{
        once: true,
        amount: 0.25,
      }}
      transition={{
        duration: 0.65,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{
        y: -4,
      }}
      className="authorization-card"
    >
      <div className="authorization-accent" />

      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">
            Authorization request
          </div>

          <div className="mt-1 text-xs text-[var(--muted)]">
            Midnight Preprod
          </div>
        </div>

        <span className="card-icon">
          <ShieldCheck className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-7">
        <label
          htmlFor="privateops-action-amount"
          className="eyebrow text-[10px]"
        >
          Action amount
        </label>

        <motion.div
          whileHover={{
            borderColor:
              'var(--border-strong)',
          }}
          className="amount-field"
        >
          <span className="text-[var(--muted)]">
            $
          </span>

          <input
            id="privateops-action-amount"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={actionAmount}
            onChange={(event) => {
              const value =
                event.target.value;

              if (/^\d*$/.test(value)) {
                setActionAmount(value);
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            placeholder="Enter amount"
            aria-label="Action amount"
          />

          <span className="ml-auto text-xs font-medium text-[var(--muted)]">
            USD
          </span>
        </motion.div>
      </div>

      <div className="private-box">
        <span className="private-box-icon">
          <LockKeyhole className="h-4 w-4" />
        </span>

        <div>
          <div className="text-sm font-semibold">
            Private policy
          </div>

          <div className="mt-0.5 text-xs text-[var(--muted)]">
            Protected witness input
          </div>
        </div>

        <span className="ml-auto hidden rounded-full border border-[var(--border)] px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-[var(--muted)] sm:inline">
          HIDDEN
        </span>
      </div>

      <CircuitCall
        wallet={wallet}
        connectedApi={connectedApi}
        address={address}
        actionAmount={actionAmount}
      />
    </motion.div>
  );
}

function Privacy() {
  return (
    <section
      id="privacy"
      className="section-divider section-soft scroll-mt-24"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial={{
              opacity: 0,
              y: 12,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
              amount: 0.3,
            }}
            transition={{
              duration: 0.55,
            }}
          >
            <div className="eyebrow">
              Privacy
            </div>

            <h2 className="section-title mt-3">
              The sensitive part stays sensitive.
            </h2>

            <p className="section-copy mt-3">
              PrivateOps is designed around selective
              disclosure. The system can verify an
              authorization condition without making the
              private policy itself public.
            </p>

            <div className="mt-8 space-y-4">
              <PrivacyRow
                icon={
                  <LockKeyhole className="h-4 w-4" />
                }
                title="Private input"
                description="The policy threshold is treated as private witness data."
              />

              <PrivacyRow
                icon={
                  <ShieldCheck className="h-4 w-4" />
                }
                title="Proof"
                description="The circuit establishes that the action satisfies the policy."
              />

              <PrivacyRow
                icon={
                  <CircleCheck className="h-4 w-4" />
                }
                title="Public result"
                description="The interface exposes the authorization result rather than the secret policy."
              />
            </div>
          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
              y: 12,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
              amount: 0.3,
            }}
            transition={{
              duration: 0.6,
              delay: 0.05,
            }}
            className="privacy-visual"
          >
            <div className="privacy-visual-top">
              <span className="mono-label">
                DISCLOSURE MODEL
              </span>

              <span className="network-badge">
                PRIVATE
              </span>
            </div>

            <div className="privacy-flow">
              <div className="privacy-flow-node privacy-flow-node-private">
                <LockKeyhole className="h-5 w-5" />

                <span>
                  Private policy
                </span>

                <small>
                  Hidden
                </small>
              </div>

              <div className="privacy-flow-arrow">
                <ArrowRight className="h-4 w-4" />
              </div>

              <div className="privacy-flow-node">
                <Sparkles className="h-5 w-5" />

                <span>
                  ZK proof
                </span>

                <small>
                  Verified
                </small>
              </div>

              <div className="privacy-flow-arrow">
                <ArrowRight className="h-4 w-4" />
              </div>

              <div className="privacy-flow-node privacy-flow-node-success">
                <Check className="h-5 w-5" />

                <span>
                  Result
                </span>

                <small>
                  Authorized
                </small>
              </div>
            </div>

            <div className="privacy-note">
              <CircleCheck className="h-4 w-4 text-[var(--accent)]" />

              <span>
                Proved without revealing your input
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function PrivacyRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      whileHover={{
        x: 3,
      }}
      className="flex gap-3"
    >
      <span className="feature-icon shrink-0">
        {icon}
      </span>

      <div>
        <div className="text-sm font-semibold">
          {title}
        </div>

        <div className="mt-1 text-sm leading-6 text-[var(--muted)]">
          {description}
        </div>
      </div>
    </motion.div>
  );
}

function Contact({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null;
}) {
  return (
    <section
      id="contact"
      className="section-divider scroll-mt-24"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <motion.div
          initial={{
            opacity: 0,
            y: shouldReduceMotion ? 0 : 15,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
            amount: 0.2,
          }}
          transition={{
            duration: 0.6,
          }}
          className="contact-shell"
        >
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_320px] lg:gap-20">
            <div>
              <div className="eyebrow">
                About the builder
              </div>

              <h2 className="section-title mt-3">
                Hi, I&apos;m Moses.
              </h2>

              <p className="section-copy mt-3 max-w-xl">
                I&apos;m a blockchain and full stack developer
                focused on building practical applications
                across Web3, smart contracts, and modern web
                technologies.
              </p>

              <p className="section-copy mt-3 max-w-xl">
                PrivateOps is one of my projects exploring
                privacy-preserving authorization with
                zero-knowledge proofs on Midnight.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="group relative">
                <div className="absolute -inset-3 rounded-full bg-[#84cc16]/0 blur-2xl transition-all duration-300 group-hover:bg-[#84cc16]/20" />

                <img
                  src="/moses.jpeg"
                  alt="Moses Ifunanya Nobei"
                  className="relative h-36 w-36 rounded-full border border-[var(--border)] bg-[var(--surface)] object-cover shadow-[0_16px_40px_var(--shadow)] transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:border-[#84cc16] group-hover:shadow-[0_18px_45px_rgba(132,204,22,0.24)] sm:h-40 sm:w-40"
                />
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://www.linkedin.com/in/mosesifunanya/"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-button"
                  aria-label="LinkedIn"
                  title="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>

                <a
                  href="https://x.com/Ifynob53"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-button"
                  aria-label="X / Twitter"
                  title="X / Twitter"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5 fill-current"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.964 6.817H1.684l7.73-8.835L1.258 2.25H8.084l4.713 6.231L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                  </svg>
                </a>

                <a
                  href="https://github.com/mosesifunanya"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-button"
                  aria-label="GitHub"
                  title="GitHub"
                >
                  <Github className="h-5 w-5" />
                </a>

                <a
                  href="mailto:mosesifunanya@gmail.com"
                  className="icon-button"
                  aria-label="Email"
                  title="Email"
                >
                  <Mail className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="brand-icon">
              <ShieldCheck className="h-[15px] w-[15px]" />
            </span>

            <span className="text-sm font-bold">
              PrivateOps
            </span>
          </div>

          <p className="mt-2 text-xs text-[var(--muted)]">
            Privacy infrastructure for verifiable AI actions.
          </p>
        </div>

        <div className="flex items-center">
          <span className="text-xs text-[var(--muted)]">
            Midnight Network · Preprod
          </span>
        </div>
      </div>
    </footer>
  );
}