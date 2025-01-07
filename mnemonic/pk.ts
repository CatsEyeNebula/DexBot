const _pk_map: { [address: string]: string } = {};

export const setPK = (address: string, pk: string) => {
  _pk_map[address] = pk;
};

export const getPK = (address: string) => {
  return _pk_map[address];
};
