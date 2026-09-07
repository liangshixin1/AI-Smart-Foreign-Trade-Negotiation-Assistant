import { describe, expect, it } from 'vitest'

import { parseTrainingStreamEvent } from './trainingApi'

describe('training SSE parsing', () => {
  it('accepts CRLF event blocks without leaking event metadata into data', () => {
    expect(
      parseTrainingStreamEvent(
        'event: message.completed\r\ndata: {"event_version":1,"message_id":"m1","content":"Done"}\r\n',
      ),
    ).toEqual({
      type: 'message.completed',
      data: { message_id: 'm1', content: 'Done' },
    })
  })

  it('ignores incompatible event versions', () => {
    expect(
      parseTrainingStreamEvent(
        'event: simulation.state.updated\ndata: {"event_version":2,"revision":9}',
      ),
    ).toBeNull()
  })
})
