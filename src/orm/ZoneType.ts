enum ZoneTypeEnum {
    circle,
    polygon
}

export type ZoneType = keyof typeof ZoneTypeEnum;