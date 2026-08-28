import { createContext, useContext } from 'react';
import AppShell from './components/AppShell';
import RouteCast from './features/RouteCast';
import RoadLore from './features/RoadLore';
import Campglass from './features/Campglass';
import Convoy from './features/Convoy';
import PassengerQuest from './features/PassengerQuest';
import TripCapsule from './features/TripCapsule';
import { useWaypointApp } from './hooks/useWaypointApp';

const modules = {
  routecast: RouteCast,
  roadlore: RoadLore,
  campglass: Campglass,
  convoy: Convoy,
  quest: PassengerQuest,
  capsule: TripCapsule,
};

const WaypointContext = createContext(null);

export function useWaypointContext() {
  return useContext(WaypointContext);
}

export default function App() {
  const app = useWaypointApp();
  const ActiveModule = modules[app.active];

  return (
    <WaypointContext.Provider value={app}>
      <AppShell>
        <ActiveModule />
      </AppShell>
    </WaypointContext.Provider>
  );
}
