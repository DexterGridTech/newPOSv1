# Assembly MMKV Persistence Repair Implementation Plan

Goal: restore the old working storage boundary so adapter stays native-minimal while assembly owns formal RN/MMKV persistence.

Steps:
1. Add regression tests for assembly storage behavior and clearDataCache semantics.
2. Introduce assembly-local MMKV state storage module using old envelope semantics.
3. Switch createAssemblyPlatformPorts to MMKV-backed stateStorage/secureStateStorage.
4. Add react-native-mmkv dependency and test mock wiring.
5. Run assembly tests and type-check, then fix any fallout.
