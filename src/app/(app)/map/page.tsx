import { Map as MapIcon } from "lucide-react";
import { Badge, Callout, PageHeader } from "@/components/ui";
import { ExploreMap } from "@/components/map/explore-map";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { getMapConfig } from "@/lib/maps/geocode";
import { listListingPins, listMachineryPins } from "@/lib/repos/listings";
import { listFarms } from "@/lib/repos/farms";

export const metadata = { title: "Map" };

export default async function MapPage() {
  const user = await requireUser("/map");
  const { t } = await getTranslatorForRequest(user.profile.simple_mode);

  const [listingPins, machineryPins, farms] = await Promise.all([
    listListingPins(),
    listMachineryPins(),
    listFarms(user.id),
  ]);

  const config = getMapConfig();
  const farmPins = farms
    .filter((farm) => farm.latitude != null && farm.longitude != null)
    .map((farm) => ({
      id: `farm-${farm.id}`,
      title: farm.name,
      latitude: farm.latitude as number,
      longitude: farm.longitude as number,
      district: farm.district,
      village: farm.village,
      kind: "farm",
    }));

  const machineListingIds = new Set(machineryPins.map((pin) => pin.id));
  const pins = [
    ...farmPins,
    ...listingPins
      .filter((pin) => !machineListingIds.has(pin.id) && pin.kind !== "machinery")
      .map((pin) => ({
        id: pin.id,
        title: pin.title,
        latitude: pin.latitude as number,
        longitude: pin.longitude as number,
        district: pin.district,
        village: pin.village,
        kind: pin.kind,
        pricePerUnit: pin.price_per_unit,
        unit: pin.unit,
      })),
    ...machineryPins
      .filter((pin) => pin.latitude != null && pin.longitude != null)
      .map((pin) => ({
        id: pin.id,
        title: pin.title,
        latitude: pin.latitude as number,
        longitude: pin.longitude as number,
        district: pin.district,
        village: null,
        kind: "machinery",
        pricePerUnit: pin.price_per_unit,
        unit: null,
      })),
  ];

  const primaryFarm = farms.find((farm) => farm.is_primary && farm.latitude != null && farm.longitude != null) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("map.title")}
        subtitle={t("map.subtitle")}
        badge={
          <Badge tone="blue" icon={<MapIcon className="size-3.5" aria-hidden />}>
            {config.provider === "mapbox" ? "Mapbox" : "OpenStreetMap"}
          </Badge>
        }
      />

      <ExploreMap
        pins={pins}
        engine={config.provider}
        token={config.token}
        initialCentre={primaryFarm ? { latitude: primaryFarm.latitude as number, longitude: primaryFarm.longitude as number } : null}
      />

      <Callout tone="info" title={t("map.dataSources")}>
        {t("map.dataSourcesBody")}
      </Callout>
    </div>
  );
}
