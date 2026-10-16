import { RouteLoader, SkeletonGrid } from "@/components/site/globus-loader";

export default function Loading() {
  return (
    <div className="-mt-16 lg:-mt-20">
      <div data-hero="dark" className="bg-night pt-24 text-white lg:pt-28">
        <RouteLoader label="Chargement" dark skeleton={false} />
      </div>
      <div className="pt-10">
        <SkeletonGrid />
      </div>
    </div>
  );
}
