import { useParams } from "react-router-dom";
import useAdminUser from "../../../store/auth.store";
import IncidentDetails from "./IncidentDetails";

export default function IncidentDetailsPage() {
  const { _id } = useParams();
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  return (
    <IncidentDetails
      key={`${companyId}:${_id}`}
      companyId={companyId}
      incidentId={_id ?? ""}
    />
  );
}
