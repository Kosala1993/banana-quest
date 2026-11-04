# Event-Driven Programming

The interface uses browser event listeners instead of polling. Named functions handle authentication form submission, puzzle submission, logout, starting/restarting an attempt, profile opening, and source-mode changes. Each handler calls an HTTP endpoint and then updates the visible screen from the server response.

The main state transitions are:

```text
welcome -> register/login -> introduction -> active attempt
active attempt -> correct answer -> next checkpoint
active attempt -> wrong answer -> one fewer life
active attempt -> fifth correct answer -> next obstacle
active attempt -> thirtieth correct answer -> completed
active attempt -> third wrong answer -> game over
```

`submitAnswer` disables the submit control while a request is in flight, displays feedback, waits for the explorer movement animation, and then loads the next puzzle. The backend treats answer submission as the authoritative event and updates attempt and result records transactionally. A duplicate puzzle submission receives HTTP 409.

The camera scroll and SVG transitions are visual effects driven by the returned checkpoint. They are separate from the server's game rules: replaying or skipping an animation cannot grant points or move the saved attempt.

Event-driven handlers make user actions and transitions easy to trace. An alternative would be a central reducer or a framework state machine, which can help at larger scale but would add a dependency and indirection for this small vanilla-JavaScript assignment. Browser events plus explicit REST responses keep the implementation inspectable.