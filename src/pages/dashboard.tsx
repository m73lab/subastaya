import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { getMessages, Locale } from "@/i18n";
import { fetcher } from "@/lib/fetcher";
import { PageLayout, EmptyState, SEO, ConfirmModal } from "@/components/common";
import { AuctionCard } from "@/components/auction";
import { useToast } from "@/components/ui/toast";
import { StatsCard, CurrencyStatsCard } from "@/components/ui/stats-card";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import {
  SortDropdown,
  auctionSortOptions,
  sidebarItemSortOptions,
  sortAuctions,
  sortItems,
} from "@/components/ui/sort-dropdown";
import { useSortFilter, usePollingInterval } from "@/hooks/ui";
import { withAuth } from "@/lib/auth/withAuth";
import { isItemEnded, isAuctionEnded, getBidStatus } from "@/utils/auction-helpers";
import { useTranslations } from "next-intl";
import {
  formatCurrency,
  decimalsForCurrency,
} from "@/utils/formatters";

interface Auction {
  id: string;
  name: string;
  description: string | null;
  endDate: string | null;
  createdAt: string;
  role: string;
  thumbnailUrl: string | null;
  imageCount: number;
  _count: {
    items: number;
    members: number;
  };
}

interface BidItem {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  currentBid: number | null;
  startingBid: number;
  highestBidderId: string | null;
  endDate: string | null;
  createdAt: string;
  currencySymbol: string;
  currencyCode: string;
  auctionId: string;
  auctionName: string;
  userHighestBid: number;
}

interface CurrencyTotal {
  code: string;
  symbol: string;
  total: number;
}

interface BidStats {
  totalBids: number;
  currencyTotals: CurrencyTotal[];
  itemsBidOn: number;
  currentlyWinning: number;
}

interface UserItem {
  id: string;
  name: string;
  auctionId: string;
  auctionName: string;
  auctionEndDate: string | null;
  currencySymbol: string;
  currencyCode: string;
  startingBid: number;
  currentBid: number | null;
  endDate: string | null;
  createdAt: string;
  thumbnailUrl: string | null;
  bidCount: number;
  isPublished: boolean;
}

interface DashboardData {
  auctions: Auction[];
  bidItems: BidItem[];
  bidStats: BidStats;
  userItems: UserItem[];
}

interface DashboardProps {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface SlotBalance {
  extras: Record<string, number>;
  perAuctionExtras: Record<string, Record<string, number>>;
  items: any[];
}

function BidItemCard({ item, userId }: { item: BidItem; userId: string }) {
  const t = useTranslations("status");
  const ended = isItemEnded(item.endDate);
  const isWinning = item.highestBidderId === userId;
  const status = getBidStatus(isWinning, ended);

  return (
    <Link
      href={`/auctions/${item.auctionId}/items/${item.id}`}
      className={`flex gap-3 p-3 rounded-xl hover:bg-base-content/5 transition-colors ${
        ended ? "opacity-60" : ""
      }`}
    >
      <div className="relative shrink-0">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            className={`w-14 h-14 object-cover rounded-lg shadow-sm ${
              ended ? "grayscale" : ""
            }`}
          />
        ) : (
          <div
            className={`w-14 h-14 bg-base-200 rounded-lg flex items-center justify-center ${
              ended ? "grayscale" : ""
            }`}
          >
            <span className="icon-[tabler--photo] size-6 text-base-content/30"></span>
          </div>
        )}
        {ended && (
          <div className="absolute -top-1 -left-1">
            <div className="badge badge-error badge-xs gap-0.5">
              <span className="icon-[tabler--flag-filled] size-2"></span>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{item.name}</div>
        <div className="text-xs text-base-content/60 truncate">
          {item.auctionName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`badge badge-xs ${
              status === "winning" || status === "won"
                ? "badge-success"
                : "badge-warning"
            }`}
          >
            {t(status)}
          </span>
          <span className="text-xs font-semibold">
            {formatCurrency(
              item.currentBid || 0,
              item.currencySymbol,
              decimalsForCurrency(item.currencyCode),
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

function UserItemCard({ item }: { item: UserItem }) {
  const t = useTranslations("dashboard");
  const tItem = useTranslations("item.edit");
  const ended =
    isItemEnded(item.endDate) || isAuctionEnded(item.auctionEndDate);
  const isDraft = !item.isPublished;

  return (
    <Link
      href={`/auctions/${item.auctionId}/items/${item.id}`}
      className={`flex gap-3 p-3 rounded-xl hover:bg-base-content/5 transition-colors border ${
        isDraft
          ? "border-warning/30 bg-warning/5"
          : "border-secondary/20 bg-secondary/5"
      } ${ended ? "opacity-60" : ""}`}
    >
      <div className="relative shrink-0">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            className={`w-14 h-14 object-cover rounded-lg shadow-sm ${
              ended ? "grayscale" : ""
            } ${isDraft ? "opacity-70" : ""}`}
          />
        ) : (
          <div
            className={`w-14 h-14 bg-base-200 rounded-lg flex items-center justify-center ${
              ended ? "grayscale" : ""
            }`}
          >
            <span className="icon-[tabler--photo] size-6 text-base-content/30"></span>
          </div>
        )}
        {isDraft ? (
          <div className="absolute -top-1 -left-1">
            <div className="badge badge-warning badge-xs gap-0.5">
              <span className="icon-[tabler--eye-off] size-2"></span>
            </div>
          </div>
        ) : ended ? (
          <div className="absolute -top-1 -left-1">
            <div className="badge badge-error badge-xs gap-0.5">
              <span className="icon-[tabler--flag-filled] size-2"></span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{item.name}</div>
        <div className="text-xs text-base-content/60 truncate">
          {item.auctionName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {isDraft ? (
            <span className="badge badge-warning badge-xs">
              {tItem("statusDraft")}
            </span>
          ) : (
            <span className="badge badge-secondary badge-xs">
              {t("myListings.bids", { count: item.bidCount })}
            </span>
          )}
          <span className="text-xs font-semibold">
            {formatCurrency(
              item.currentBid || item.startingBid,
              item.currencySymbol,
              decimalsForCurrency(item.currencyCode),
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

function QuotaPanel({ auctions }: { auctions: any[] }) {
  const t = useTranslations("dashboard.slots");
  const tCard = useTranslations("auction.card");
  const { data: slots } = useSWR<SlotBalance>("/api/user/slots", fetcher);
  const perAuctionExtras = slots?.perAuctionExtras || {};
  const owned = auctions.filter((a: any) => a.role === "OWNER");
  const max = 1 + (slots?.extras?.maxAuctions || 0);
  const current = owned.length;
  const [expanded, setExpanded] = useState(false);
  if (owned.length === 0) return null;
  const visible = expanded ? owned : owned.slice(0, 2);
  return (
    <div className="card bg-base-100 border border-base-content/5 shadow-sm mb-8">
      <div className="card-body p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold flex items-center gap-2">
            <span className="icon-[tabler--gauge] size-5 text-primary"></span>
            {t("quotaTitle") || "Uso y límites"}
          </h2>
          {slots && (
            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <div className="text-right leading-tight">
                <div className="text-[11px] text-base-content/60 font-medium uppercase tracking-wide">
                  {t("auctionCounterLabel") || "Subastas"}
                </div>
                <div
                  className={`font-mono font-bold text-sm ${current >= max ? "text-warning" : ""}`}
                >
                  {current} / {max}
                </div>
              </div>
              <progress
                className={`progress w-24 h-1.5 ${current >= max ? "progress-warning" : "progress-primary"}`}
                value={current}
                max={max}
              ></progress>
            </div>
          )}
        </div>
        <div className="space-y-4 mt-4">
          {visible.map((a: any) => {
            const extras = perAuctionExtras[a.id] || { maxItems: 0, maxMembers: 0, maxImages: 0 };
            const limits = { items: 3 + (extras.maxItems || 0), members: 10 + (extras.maxMembers || 0), images: 3 + (extras.maxImages || 0) };
            const used = {
              items: a._count?.items || 0,
              members: a._count?.members || 0,
              photos: a.imageCount || 0,
            };
            const photoCapacity = used.items * limits.images;
            const ended = isAuctionEnded(a.endDate);
            return (
              <div key={a.id} className="rounded-xl bg-base-200/50 p-4">
                <div className="flex items-center gap-2">
                  <div className="font-semibold truncate">{a.name}</div>
                  {ended && (
                    <span className="badge badge-error badge-xs gap-1 shrink-0">
                      <span className="icon-[tabler--flag-filled] size-2.5"></span>
                      {tCard("ended")}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                  <div>
                    <div className="text-base-content/60 text-xs">Lotes</div>
                    <div className="font-mono font-bold">{used.items}/{limits.items}</div>
                    <progress className="progress progress-primary w-full h-1" value={used.items} max={limits.items}></progress>
                  </div>
                  <div>
                    <div className="text-base-content/60 text-xs">Personas</div>
                    <div className="font-mono font-bold">{used.members}/{limits.members}</div>
                    <progress className="progress progress-secondary w-full h-1" value={used.members} max={limits.members}></progress>
                  </div>
                  <div>
                    <div className="text-base-content/60 text-xs">Fotos</div>
                    <div className="font-mono font-bold">
                      {used.photos}
                      {photoCapacity > 0 && (
                        <span className="text-xs font-normal opacity-60">/{photoCapacity}</span>
                      )}
                    </div>
                    {photoCapacity > 0 ? (
                      <progress className="progress progress-accent w-full h-1" value={used.photos} max={photoCapacity}></progress>
                    ) : (
                      <div className="text-xs text-base-content/50">{t("fotosHint") || "Límite por artículo"}</div>
                    )}
                  </div>
                </div>
                <Link href="/slots" className="btn btn-ghost btn-xs mt-3 gap-1">
                  {t("manageSlots") || "Gestionar slots"} <span className="icon-[tabler--arrow-right] size-3"></span>
                </Link>
              </div>
            );
          })}
        </div>
        {owned.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn btn-ghost btn-sm w-full mt-2"
          >
            {expanded ? t("showLess") || "Ver menos" : t("showMore", { count: owned.length - 2 }) || `Ver ${owned.length - 2} más`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage({ user }: DashboardProps) {
  const t = useTranslations("dashboard");
  const tStats = useTranslations("dashboard.stats");
  const tEmpty = useTranslations("dashboard.empty");
  const tAuctionSettings = useTranslations("auction.settings");
  const tErrors = useTranslations("errors");
  const { showToast } = useToast();
  const { currentSort: auctionSort } = useSortFilter(
    "auctionSort",
    "date-desc",
  );
  const { currentSort: bidSort } = useSortFilter("bidSort", "date-desc");

  // Use medium priority for dashboard, pauses when tab hidden
  const refreshInterval = usePollingInterval({ priority: "medium" });

  // Client-side data fetching with polling for bid status updates
  const { data, isLoading, mutate } = useSWR<DashboardData>(
    "/api/user/dashboard",
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
    },
  );

  const auctions = useMemo(() => data?.auctions ?? [], [data?.auctions]);
  const bidItems = useMemo(() => data?.bidItems ?? [], [data?.bidItems]);
  const bidStats = data?.bidStats ?? {
    totalBids: 0,
    currencyTotals: [],
    itemsBidOn: 0,
    currentlyWinning: 0,
  };
  const userItems = data?.userItems ?? [];
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAuction = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/auctions/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        showToast(result.message || tErrors("auction.updateFailed"), "error");
        return;
      }
      showToast(tAuctionSettings("deleteSuccess"), "success");
      setDeleteTarget(null);
      mutate();
    } catch {
      showToast(tErrors("generic"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const sortedAuctions = useMemo(
    () => sortAuctions(auctions, auctionSort),
    [auctions, auctionSort],
  );
  const myAuctions = useMemo(
    () => sortedAuctions.filter((a) => a.role === "OWNER"),
    [sortedAuctions],
  );
  const otherAuctions = useMemo(
    () => sortedAuctions.filter((a) => a.role !== "OWNER"),
    [sortedAuctions],
  );

  const sortedBidItems = useMemo(
    () => sortItems(bidItems, bidSort),
    [bidItems, bidSort],
  );
  // Slots/cuotas son feature solo-cloud: si la ruta no existe (self-hosted),
  // no hay límites que aplicar.
  const { data: quotaSlots } = useSWR<SlotBalance>(
    "/api/user/slots",
    fetcher,
    { shouldRetryOnError: false },
  );
  const isCloudPanel = !!quotaSlots;
  const auctionLimit = 1 + (quotaSlots?.extras?.maxAuctions || 0);
  const isAuctionLimitReached =
    isCloudPanel && myAuctions.length >= auctionLimit;

  // Show skeleton while loading
  if (isLoading) {
    return (
      <>
        <SEO title={t("seo.title")} description={t("seo.description")} />
        <PageLayout user={user}>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="icon-[tabler--layout-dashboard] size-7"></span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t("title")}</h1>
                <p className="text-base-content/60">
                  {t("welcome", { name: user.name || user.email })}
                </p>
              </div>
            </div>
            {isAuctionLimitReached ? (
              <div className="tooltip tooltip-bottom" data-tip={t("limitReached") || "Límite alcanzado"}>
                <button
                  disabled
                  className="btn btn-primary w-full sm:w-auto btn-disabled"
                >
                  <span className="icon-[tabler--lock] size-5"></span>
                  {t("createAuction")}
                </button>
              </div>
            ) : (
              <Link
                href="/auctions/create"
                className="btn btn-primary w-full sm:w-auto"
              >
                <span className="icon-[tabler--plus] size-5"></span>
                {t("createAuction")}
              </Link>
            )}
          </div>
          <SkeletonDashboard />
        </PageLayout>
      </>
    );
  }

  return (
    <>
      <SEO title={t("seo.title")} description={t("seo.description")} />
      <PageLayout user={user}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="icon-[tabler--layout-dashboard] size-7"></span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="text-base-content/60">
                {t("welcome", { name: user.name || user.email })}
              </p>
            </div>
          </div>
          {isAuctionLimitReached ? (
            <div
              className="tooltip tooltip-bottom"
              data-tip={t("limitReached") || "Límite alcanzado"}
            >
              <button
                disabled
                className="btn btn-primary w-full sm:w-auto btn-disabled"
              >
                <span className="icon-[tabler--lock] size-5"></span>
                {t("createAuction")}
              </button>
            </div>
          ) : (
            <Link
              href="/auctions/create"
              className="btn btn-primary w-full sm:w-auto"
            >
              <span className="icon-[tabler--plus] size-5"></span>
              {t("createAuction")}
            </Link>
          )}
        </div>

        {/* Stats Cards */}
        {bidStats.totalBids > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatsCard
              icon="icon-[tabler--gavel]"
              iconColor="primary"
              value={bidStats.totalBids}
              label={tStats("totalBids")}
            />
            <CurrencyStatsCard
              icon="icon-[tabler--currency-dollar]"
              iconColor="secondary"
              currencyTotals={bidStats.currencyTotals}
              label={tStats("totalBidAmount")}
            />
            <StatsCard
              icon="icon-[tabler--package]"
              iconColor="accent"
              value={bidStats.itemsBidOn}
              label={tStats("itemsBidOn")}
            />
            <StatsCard
              icon="icon-[tabler--trophy]"
              iconColor="success"
              value={bidStats.currentlyWinning}
              label={tStats("currentlyWinning")}
            />
          </div>
        )}

        {/* My Listings Section */}
        {userItems.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-base-content flex items-center gap-2">
                  <span className="icon-[tabler--tag] size-5 text-secondary"></span>
                  {t("myListings.title")}
                </h2>
                <p className="text-sm text-base-content/60">
                  {t("myListings.subtitle")}
                </p>
              </div>
            </div>
            <div className="card bg-base-100 shadow border border-secondary/10">
              <div className="card-body p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                  {userItems.map((item) => (
                    <UserItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Your Bids Section */}
        {bidItems.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-base-content">
                {t("activeBids.title")}
              </h2>
              <SortDropdown
                options={sidebarItemSortOptions}
                currentSort={bidSort}
                paramName="bidSort"
              />
            </div>
            <div className="card bg-base-100 shadow">
              <div className="card-body p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                  {sortedBidItems.map((item) => (
                    <BidItemCard key={item.id} item={item} userId={user.id} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {isCloudPanel && <QuotaPanel auctions={auctions} />}

        {/* My Auctions Section */}
        {myAuctions.length > 0 && (
          <div className="mb-12">
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-base-content">
                {t("myAuctions.title")}
              </h2>
              <p className="text-sm text-base-content/60">
                {t("myAuctions.description")}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myAuctions.map((auction) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  onDelete={(a) => setDeleteTarget(a)}
                />
              ))}
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={!!deleteTarget}
          title={tAuctionSettings("delete")}
          message={
            deleteTarget
              ? tAuctionSettings("confirmDelete", { name: deleteTarget.name })
              : ""
          }
          confirmLabel={tAuctionSettings("delete")}
          variant="error"
          isLoading={isDeleting}
          onConfirm={handleDeleteAuction}
          onClose={() => !isDeleting && setDeleteTarget(null)}
        />

        {/* Auctions Section */}
        {auctions.length === 0 ? (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <EmptyState
                icon="icon-[tabler--gavel]"
                title={tEmpty("title")}
                description={tEmpty("description")}
                action={
                  isAuctionLimitReached ? (
                    <div
                      className="tooltip tooltip-bottom"
                      data-tip={t("limitReached") || "Límite alcanzado"}
                    >
                      <button
                        disabled
                        className="btn btn-primary btn-disabled"
                      >
                        <span className="icon-[tabler--lock] size-5"></span>
                        {tEmpty("createFirst")}
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/auctions/create"
                      className="btn btn-primary"
                    >
                      <span className="icon-[tabler--plus] size-5"></span>
                      {tEmpty("createFirst")}
                    </Link>
                  )
                }
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-base-content">
                {t("auctions.title")}
              </h2>
              {otherAuctions.length > 0 && (
                <SortDropdown
                  options={auctionSortOptions}
                  currentSort={auctionSort}
                  paramName="auctionSort"
                />
              )}
            </div>
            {otherAuctions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {otherAuctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-base-content/15 bg-base-100/50 px-6 py-10 text-center">
                <span className="icon-[tabler--users] size-10 text-base-content/25 block mx-auto mb-3"></span>
                <p className="font-semibold">
                  {t("myAuctions.joinedEmptyTitle")}
                </p>
                <p className="text-sm text-base-content/60 mt-1 max-w-md mx-auto">
                  {t("myAuctions.joinedEmptyDescription")}
                </p>
                {isAuctionLimitReached ? (
                  <div
                    className="tooltip tooltip-bottom"
                    data-tip={t("limitReached") || "Límite alcanzado"}
                  >
                    <button
                      disabled
                      className="btn btn-primary btn-sm mt-4 gap-1.5 btn-disabled"
                    >
                      <span className="icon-[tabler--lock] size-5"></span>
                      {t("createAuction")}
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/auctions/create"
                    className="btn btn-primary btn-sm mt-4 gap-1.5"
                  >
                    <span className="icon-[tabler--plus] size-4"></span>
                    {t("createAuction")}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </PageLayout>
    </>
  );
}

export const getServerSideProps = withAuth(async (context) => {
  const messages = await getMessages(context.locale as Locale);

  return {
    props: {
      user: {
        id: context.session.user.id,
        name: context.session.user.name || null,
        email: context.session.user.email || "",
      },
      messages,
    },
  };
});
