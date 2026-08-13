import { redirect } from "next/navigation";

/** Admin console entry — always land on the dashboard. */
export default function Home() {
  redirect("/dashboard");
}
