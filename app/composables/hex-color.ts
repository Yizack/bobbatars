export function useHexColor (initialValue: string) {
  const input = ref(initialValue);
  const parsed = computed(() => parseHexColor(input.value));
  const color = computed({
    get: () => {
      const hex = parsed.value;
      if (!hex) return "#000000";
      const digits = hex.slice(1).toUpperCase();
      const rgb = digits.length === 3 ? [...digits].map(digit => digit.repeat(2)).join("") : digits.slice(0, 6);
      return `#${rgb}`;
    },
    set: (value: string) => {
      const rgb = value.replace(/^#/, "").slice(0, 6).toUpperCase();
      const digits = parsed.value?.slice(1).toUpperCase() ?? "";
      const alpha = digits.length === 8 ? digits.slice(6) : parsed.value ? "" : "00";
      input.value = `${rgb}${alpha}`;
    }
  });
  const opacity = computed({
    get: () => {
      if (!parsed.value) return 0;
      const digits = parsed.value.slice(1);
      return digits.length === 8 ? Math.round(Number.parseInt(digits.slice(6), 16) * 100 / 255) : 100;
    },
    set: (value: number) => {
      const percentage = Math.min(100, Math.max(0, Math.round(value)));
      const rgb = color.value.slice(1);
      const alpha = Math.round(percentage * 255 / 100).toString(16).padStart(2, "0").toUpperCase();
      input.value = percentage === 100 ? rgb : `${rgb}${alpha}`;
    }
  });
  const field = computed({
    get: () => {
      if (!parsed.value) return input.value;
      const digits = parsed.value.slice(1).toUpperCase();
      if (digits.length !== 8) return digits;
      if (opacity.value === 100) return digits.slice(0, 6);
      if (opacity.value === 0) return `${digits.slice(0, 6)}00`;
      return digits;
    },
    set: (value: string) => {
      input.value = value.trim().replace(/^#/, "").slice(0, 8).toUpperCase();
    }
  });
  const value = computed(() => {
    if (!parsed.value) return undefined;
    if (opacity.value === 100) return color.value;
    return `${color.value}${parsed.value.slice(-2).toUpperCase()}`;
  });
  const error = computed(() => parsed.value ? "" : "Enter 3, 6, or 8 hexadecimal digits.");

  return { color, opacity, field, value, error };
}
