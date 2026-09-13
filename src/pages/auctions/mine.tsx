import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageLayout, EmptyState, SEO, ConfirmModal } from "@/components/common";
import { AuctionCard } from "@/components/auction";
import { useToast } from "@/components/ui/toast";
import { getMessages, Locale } from "@/i18n";
import { useTranslations } from "next-intl";
import { withAuth } from "@/lib/auth/withAuth";

interface Auction {
  id: string;
  name: string;
  description: string | null;
  endDate: string | null;
  createdAt: string;
  role: string;
  thumbnailUrl: string | null;
  _count: {
    items: number;
    members: number;
  };
}

interface DashboardData {
  auctions: Auction[];
}

interface SlotBalance {
  extras: Record<string, number>;
  perAuctionExtras: Record<string, Record<string, number>>;
  items: any[];
}

interface MinePageProps {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function MyAuctionsPage({ user }: MinePageProps) {
  const t = useTranslations("dashboard");
  const tEmpty = useTranslations("dashboard.empty");
  const tAuctionSettings = useTranslations("auction.settings");
  const tErrors = useTranslations("errors");
  const { showToast } = useToast();
  const { data, isLoading, mutate } = useSWR<DashboardData>(
    "/api/user/dashboard",
    fetcher,
  );

  // Slots/cuotas son feature solo-cloud: si la ruta no existe (self-hosted),
  // no hay límites que aplicar.
  const { data: quotaSlots } = useSWR<SlotBalance>(
    "/api/user/slots",
    fetcher,
    { shouldRetryOnError: false },
  );

  const myAuctions = (data?.auctions ?? []).filter(
    (a) => a.role === "OWNER",
  );
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

  const isCloudPanel = !!quotaSlots;
  const auctionLimit = 1 + (quotaSlots?.extras?.maxAuctions || 0);
  const isAuctionLimitReached =
    isCloudPanel && myAuctions.length >= auctionLimit;

  const createButton = (label: string, full?: boolean) =>
    isAuctionLimitReached ? (
      <div
        className="tooltip tooltip-bottom"
        data-tip={t("limitReached") || "Límite alcanzado"}
      >
        <button
          disabled
          className={`btn btn-primary btn-disabled ${full ? "w-full sm:w-auto" : ""}`}
        >
          <span className="icon-[tabler--lock] size-5"></span>
          {label}
        </button>
      </div>
    ) : (
      <Link
        href="/auctions/create"
        className={`btn btn-primary ${full ? "w-full sm:w-auto" : ""}`}
      >
        <span className="icon-[tabler--plus] size-5"></span>
        {label}
      </Link>
    );

  return (
    <>
      <SEO
        title={t("myAuctions.title")}
        description={t("myAuctions.description")}
      />
      <PageLayout user={user}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="icon-[tabler--crown] size-7"></span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("myAuctions.title")}</h1>
              <p className="text-base-content/60">
                {t("myAuctions.description")}
              </p>
            </div>
          </div>
          {createButton(t("createAuction"), true)}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : myAuctions.length === 0 ? (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <EmptyState
                icon="icon-[tabler--crown]"
                title={t("myAuctions.title")}
                description={t("myAuctions.description")}
                action={createButton(tEmpty("createFirst"))}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                onDelete={(a) => setDeleteTarget(a)}
              />
            ))}
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