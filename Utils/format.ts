
import { BigNumber as BN } from "bignumber.js";

export const toFixed = (num: number, decimal: number): string => {
    const n = BN(num);
    return n.toFixed(decimal);
  };
  