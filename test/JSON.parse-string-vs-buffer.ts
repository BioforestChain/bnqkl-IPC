const obj = {
    a: [1, 2, "3"],
    o: {
        n: "gaubee"
    }
}

const str = JSON.stringify(obj);
const buff = Buffer.from(str);
const TIMES = 10000;

import { performance } from 'perf_hooks';
// parse string
{
    const st = performance.now();
    for (let i = 0; i < TIMES; i += 1) {
        JSON.parse(str);
    }
    console.log(performance.now() - st);
}
// parse buffer
{
    const st = performance.now();
    for (let i = 0; i < TIMES; i += 1) {
        JSON.parse(buff as any);
    }
    console.log(performance.now() - st);
}
