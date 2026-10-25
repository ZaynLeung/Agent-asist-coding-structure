# 常用代码片段

## Python：重试执行

```python
import time
from typing import Callable, TypeVar

T = TypeVar("T")

def retry(fn: Callable[[], T], attempts: int = 3, sleep_s: float = 0.5) -> T:
    last_err: Exception | None = None
    for _ in range(attempts):
        try:
            return fn()
        except Exception as e:
            last_err = e
            time.sleep(sleep_s)
    assert last_err is not None
    raise last_err
```

## TypeScript：结果类型

```ts
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(message: string): Result<never> {
  return { ok: false, error: new Error(message) };
}
```

## Shell：确保命令存在

```sh
require_cmd() {
  command -v "$1" >/dev/null 2>&1
}
```
