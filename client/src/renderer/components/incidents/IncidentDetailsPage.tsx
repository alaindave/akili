import { useParams } from "react-router-dom";
import useAdminUser from "../../../store/auth.store";
import IncidentDetails from "./IncidentDetails";

import { useModule } from "../../context/ModuleContext";

export default function IncidentDetailsPage() {
  const { module } = useModule();
  const { _id } = useParams();
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  return (
    <IncidentDetails
      key={`${companyId}:${module}:${_id}`}
      companyId={companyId}
      incidentId={_id ?? ""}
    />
  );
}
