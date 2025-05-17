enum PatientStateEnum {
    unknown,
    home,
    safe,
    guard,
    danger
}

export type PatientState = keyof typeof PatientStateEnum;