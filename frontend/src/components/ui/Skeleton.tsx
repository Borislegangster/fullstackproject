interface SkeletonProps {
  className?: string;
  /** When set, SkeletonText renders this many stacked lines. */
  lines?: number;
}
export function SkeletonText({ className = '', lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`bg-globus-light animate-pulse rounded h-4 ${
              i === lines - 1 ? 'w-3/4' : 'w-full'
            }`}>
            <div className="invisible">placeholder</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`bg-globus-light animate-pulse rounded ${className}`}>
      <div className="invisible">placeholder</div>
    </div>);

}
export function SkeletonImage({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-globus-light animate-pulse rounded-xl ${className}`} />);

}
export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
      
      <SkeletonImage className="w-full h-48 mb-4" />
      <SkeletonText className="h-6 w-3/4 mb-3" />
      <SkeletonText className="h-4 w-full mb-2" />
      <SkeletonText className="h-4 w-2/3" />
    </div>);

}
export function SkeletonHero({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`relative pt-28 pb-20 md:pt-40 md:pb-32 lg:min-h-[85vh] flex items-center bg-globus-light animate-pulse ${className}`}>
      
      <div className="container mx-auto px-4">
        <div className="max-w-3xl">
          <SkeletonText className="h-6 w-48 mb-6" />
          <SkeletonText className="h-14 w-full mb-4" />
          <SkeletonText className="h-14 w-3/4 mb-6" />
          <SkeletonText className="h-6 w-full mb-2" />
          <SkeletonText className="h-6 w-2/3 mb-10" />
          <div className="flex gap-4">
            <SkeletonText className="h-14 w-48" />
            <SkeletonText className="h-14 w-48" />
          </div>
        </div>
      </div>
    </div>);

}
export function SkeletonGrid({
  count = 3,
  className = ''


}: SkeletonProps & {count?: number;}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 ${className}`}>
      
      {Array.from({
        length: count
      }).map((_, i) =>
      <SkeletonCard key={i} />
      )}
    </div>);

}