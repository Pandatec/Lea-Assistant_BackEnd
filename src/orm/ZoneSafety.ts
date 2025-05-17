enum ZoneSafetyEnum {
    danger,
    home,
    safe
}

export type ZoneSafetyType = keyof typeof ZoneSafetyEnum;