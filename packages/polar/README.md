# @hrkit/polar

Polar PMD protocol support for @hrkit. Enables ECG and accelerometer streaming on Polar H10, H9, OH1, and Verity Sense.

## Usage

```typescript
import { POLAR_H10, isPolarConnection } from '@hrkit/polar';
import { connectToDevice } from '@hrkit/core';

const conn = await connectToDevice(transport, { prefer: [POLAR_H10] });

if (isPolarConnection(conn)) {
  for await (const frame of conn.ecg()) {
    console.log('ECG samples:', frame.samples);
  }
}
```

## Device Profiles

| Profile | ECG | Accelerometer |
|---------|-----|---------------|
| `POLAR_H10` | ✅ | ✅ |
| `POLAR_H9` | ✅ | ❌ |
| `POLAR_OH1` | ❌ | ✅ |
| `POLAR_VERITY_SENSE` | ❌ | ✅ |
