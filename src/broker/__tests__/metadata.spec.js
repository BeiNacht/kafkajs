const Broker = require('../index')
const {
  secureRandom,
  createConnection,
  newLogger,
  createTopic,
  retryProtocol,
  testIfKafka011,
} = require('testHelpers')

describe('Broker > Metadata', () => {
  let topicName, broker

  beforeEach(() => {
    topicName = `test-topic-${secureRandom()}`
    broker = new Broker({
      connection: createConnection(),
      logger: newLogger(),
    })
  })

  afterEach(async () => {
    broker && (await broker.disconnect())
  })

  test('rejects the Promise if lookupRequest is not defined', async () => {
    await expect(broker.metadata()).rejects.toEqual(new Error('Broker not connected'))
  })

  test('request', async () => {
    await broker.connect()
    await createTopic({ topic: topicName })

    const response = await retryProtocol(
      'LEADER_NOT_AVAILABLE',
      async () => await broker.metadata([topicName])
    )

    expect(response).toMatchObject({
      throttleTime: 0,
      brokers: expect.arrayContaining([
        {
          host: expect.stringMatching(/\d+\.\d+\.\d+\.\d+/),
          nodeId: expect.any(Number),
          port: expect.any(Number),
          rack: null,
        },
      ]),
      clusterId: expect.stringMatching(/[a-zA-Z0-9-]/),
      controllerId: expect.any(Number),
      topicMetadata: [
        {
          isInternal: false,
          partitionMetadata: [
            {
              isr: expect.any(Array),
              leader: expect.any(Number),
              partitionErrorCode: 0,
              partitionId: 0,
              replicas: expect.any(Array),
            },
          ],
          topic: topicName,
          topicErrorCode: 0,
        },
      ],
    })
  })

  describe('when allowAutoTopicCreation is disabled and the topic does not exist', () => {
    beforeEach(() => {
      topicName = `test-topic-${secureRandom()}`
      broker = new Broker({
        connection: createConnection(),
        allowAutoTopicCreation: false,
        logger: newLogger(),
      })
    })

    testIfKafka011('returns UNKNOWN_TOPIC_OR_PARTITION', async () => {
      await broker.connect()

      await expect(broker.metadata([topicName])).rejects.toHaveProperty(
        'type',
        'UNKNOWN_TOPIC_OR_PARTITION'
      )
    })
  })
})
