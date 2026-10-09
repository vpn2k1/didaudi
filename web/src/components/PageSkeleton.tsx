import { PlaceCardSkeleton, Skeleton } from '@/components/ui';

/** Skeleton cả trang. Không đặt ở app/loading.tsx vì streaming làm trang 404 trả status 200. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-9 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-12 w-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <PlaceCardSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="hidden h-[60vh] rounded-2xl lg:block" />
      </div>
    </div>
  );
}
