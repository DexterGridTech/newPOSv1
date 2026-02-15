export * from './master-ws'

const statesNeedToSync = ["A", "B"]
const stateFromSlave = {
    A: {
        a1: {
            updateAt: 1687532400000
        },
        a2: {
            updateAt: 1687532400000
        }
    },
    B: {
        b1: {
            updateAt: 1687532400000
        }
    }
}
const stateAtLocal = {
    A: {
        a1: {
            updateAt: 1687532400001,
            prop1: "123",
            prop2: {
                prop2_1: "...",
                prop2_2: {
                    prop2_2_1: "..."
                }
            }
        },
        a3: {
            updateAt: 1687532400000,
            prop4: "123",
            prop5: {
                prop5_1: "...",
                prop5_2: {
                    prop5_2_1: "..."
                }
            }
        },
        a4: "abc",
        a5: 123,
        a6: {
            name: "John"
        }
    },
    B: {
        b1: {
            updateAt: 1687532400000,
            prop6: "123",
            prop7: {
                prop7_1: "...",
                prop7_2: {
                    prop5_2_1: "..."
                }
            }
        },
        b2: {
            updateAt: 1687532400000,
            prop8: "123",
            prop9: {
                prop7_1: "...",
                prop7_2: {
                    prop5_2_1: "..."
                }
            }
        },
    },
    C: {
        c1: {
            updateAt: 1687532400000,
            prop8: "123",
            prop9: {
                prop7_1: "...",
                prop7_2: {
                    prop5_2_1: "..."
                }
            }
        }
    }
}

const result = {
    A: {
        a1: {
            updateAt: 1687532400001,
            prop1: "123",
            prop2: {
                prop2_1: "...",
                prop2_2: {
                    prop2_2_1: "..."
                }
            }
        },
        a2: null,
        a3: {
            updateAt: 1687532400000,
            prop4: "123",
            prop5: {
                prop5_1: "...",
                prop5_2: {
                    prop5_2_1: "..."
                }
            }
        },
    },
    B: {
        b2: {
            updateAt: 1687532400000,
            prop8: "123",
            prop9: {
                prop7_1: "...",
                prop7_2: {
                    prop5_2_1: "..."
                }
            }
        },
    }
}