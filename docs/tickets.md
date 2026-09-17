# Implementation tickets

The product behavior lives in [`spec.md`](spec.md). These tickets split the implementation into dependency-ordered slices.

1. [#1 Bootstrap the TypeScript extension and ask_user contract](https://github.com/zac-dougo/pi-questions/issues/1)
2. [#2 Implement the questionnaire state machine](https://github.com/zac-dougo/pi-questions/issues/2), depends on #1
3. [#3 Build the interactive questionnaire overlay](https://github.com/zac-dougo/pi-questions/issues/3), depends on #2
4. [#4 Wire ask_user into the Pi tool lifecycle](https://github.com/zac-dougo/pi-questions/issues/4), depends on #1–#3
5. [#5 Add the RPC and non-interactive mode behavior](https://github.com/zac-dougo/pi-questions/issues/5), depends on #2 and #4
6. [#6 Package, document, and release-test the extension](https://github.com/zac-dougo/pi-questions/issues/6), depends on #4 and #5
