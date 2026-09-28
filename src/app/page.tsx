import DiagnosticsApp from "@/components/DiagnosticsApp";
import { getServices } from "@/lib/factory";
import { developmentNames } from "@/lib/knowledge";

// the services are built from the environment at request time, not at build time
export const dynamic = "force-dynamic";

export default function Home() {
  const { settings, knowledge, samples } = getServices();
  return (
    <DiagnosticsApp
      developments={developmentNames(knowledge)}
      samples={samples}
      demoMode={settings.demoMode}
      maxUploadMb={Math.round(settings.maxUploadBytes / 1024 / 1024)}
      passwordProtected={Boolean(settings.appPassword)}
    />
  );
}
