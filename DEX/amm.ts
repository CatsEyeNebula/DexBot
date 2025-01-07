import { SwapAmount, ToSwapAmountParams } from "./types";

export const toPathAmount = ({
  a2b,
  token_a,
  token_b,
  fee,
  token_a_amount,
  token_b_amount,
  decimals_a,
  decimals_b,
  price,
  token_a_reserves,
  token_b_reserves,
}: ToSwapAmountParams): SwapAmount => {
  const in_token = a2b ? token_a : token_b;
  const out_token = a2b ? token_b : token_a;
  const in_amount = a2b ? token_a_amount : token_b_amount;
  const out_amount = a2b ? token_b_amount : token_a_amount;
  const in_decimals = a2b ? decimals_a : decimals_b;
  const out_decimals = a2b ? decimals_b : decimals_a;
  const exact_in = !!in_amount;
  if (price) {
    price = a2b ? price : 1 / price;
  }
  const in_reserves = a2b ? token_a_reserves : token_b_reserves;
  const out_reserves = a2b ? token_b_reserves : token_a_reserves;

  return {
    fee,
    exact_in,
    in_token,
    out_token,
    in_amount,
    out_amount,
    in_decimals,
    out_decimals,
    in_reserves,
    out_reserves,
    price,
  };
};

export const calcAMMAmount = (params: ToSwapAmountParams) => {
  const rp = toPathAmount(params);

  let in_amount_bn: bigint;
  let out_amount_bn: bigint;

  if (rp.exact_in) {
    in_amount_bn = BigInt(
      Math.floor(rp.in_amount * Math.pow(10, rp.in_decimals))
    );
    out_amount_bn =
      (in_amount_bn * rp.out_reserves * BigInt(10000 - rp.fee)) /
      BigInt(10000) /
      (in_amount_bn + rp.in_reserves);
  } else {
    out_amount_bn = BigInt(
      Math.floor(rp.out_amount * Math.pow(10, rp.out_decimals))
    );
    in_amount_bn =
      (out_amount_bn * rp.in_reserves) /
      (((rp.out_reserves - out_amount_bn) * BigInt(10000 - rp.fee)) /
        BigInt(10000));
  }
  rp.in_amount =
    parseFloat(in_amount_bn.toString()) / Math.pow(10, rp.in_decimals);
  rp.out_amount =
    parseFloat(out_amount_bn.toString()) / Math.pow(10, rp.out_decimals);

  rp.price = params.a2b
    ? rp.out_amount / rp.in_amount
    : rp.in_amount / rp.out_amount;
  rp.price = Math.max(rp.price, 0);

  return {
    ...rp,
    in_amount_bn: in_amount_bn,
    out_amount_bn: out_amount_bn,
  };
};
