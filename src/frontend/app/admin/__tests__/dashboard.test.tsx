import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import AdminDashboard from "../page";

it("renders dashboard heading", () => {
  render(<AdminDashboard />);
  expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
});
