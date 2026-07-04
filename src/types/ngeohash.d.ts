declare module 'ngeohash' {
  function encode(latitude: number, longitude: number, precision?: number): string
  function decode(hash: string): { latitude: number; longitude: number }
  export { encode, decode }
}
