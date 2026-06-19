import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import AdminLayout from "../layout";

it("renders children", () => {
  render(<AdminLayout><div>test content</div></AdminLayout>);
  expect(screen.getByText("test content")).toBeInTheDocument();
});
