import { feature, mesh } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, MultiLineString, Geometry } from "geojson";
import statesTopo from "us-atlas/states-10m.json";

export type StateFeature = Feature<Geometry, { name: string }> & { id: string };

const topo = statesTopo as unknown as Topology;

export const states = feature(topo, topo.objects.states as any) as unknown as FeatureCollection<Geometry, { name: string }> & {
  features: StateFeature[];
};
export const stateBorders = mesh(topo, topo.objects.states as any, (a, b) => a !== b) as MultiLineString;

export const stateByFips = (fips: string) => states.features.find((f) => f.id === fips);
