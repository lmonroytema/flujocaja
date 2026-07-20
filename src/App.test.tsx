import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("App", () => {
  it("renderiza la navegación principal del panel", () => {
    render(<App />);

    expect(screen.getByAltText("EMTA")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Flujo de caja")).toBeInTheDocument();
  });
});
