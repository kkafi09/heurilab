import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { Button as BeButton, type ButtonProps } from "./motion/button/base";
export function Button(props: ButtonProps) {
  return <BeButton {...props} className={`app-button ${props.className ?? ""}`} />;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement<{ id?: string; "aria-labelledby"?: string }>(children)
    ? cloneElement(children, { id, "aria-labelledby": `${id}-label` })
    : children;
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      {control}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-symbol">↗</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export const formatNumber = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : "—";
export const stopLabels = {
  "iteration-limit": "Batas iterasi tercapai",
  "minimum-temperature": "Suhu minimum tercapai",
  "no-eligible": "Tidak ada kandidat eligible",
  "empty-neighborhood": "Neighborhood kosong",
  cancelled: "Dibatalkan pengguna",
};
