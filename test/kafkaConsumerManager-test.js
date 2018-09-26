'use strict';

let sinon = require('sinon'),
    should = require('should'),
    KafkaConsumerManager = require('../src/kafkaConsumerManager'), //,
    KafkaProducer = require('../src/producers/kafkaProducer'),
    KafkaConsumer = require('../src/consumers/kafkaConsumer'),
    DependencyChecker = require('../src/healthCheckers/dependencyChecker'),
    KafkaThrottlingManager = require('../src/throttling/kafkaThrottlingManager');

let fullConfiguration = {
    KafkaUrl: 'url',
    GroupId: 'GroupId',
    KafkaConnectionTimeout: '1000',
    KafkaOffsetDiffThreshold: '3',
    Topics: ['topic-a', 'topic-b'],
    AutoCommit: true,
    MessageFunction: (msg) => {}
    // ResumePauseCheckFunction: () => {},
    // ResumePauseIntervalMs: 1000
};

describe('Verify mandatory params', () => {
    let sandbox, kafkaConsumerManager = new KafkaConsumerManager(), producerInitStub,
        consumerInitStub, dependencyInitStub, throttlingInitStub;

    beforeEach(() => {
        producerInitStub.resolves();
        consumerInitStub.resolves();
        dependencyInitStub.returns({});
        throttlingInitStub.returns({});
    });

    before(() => {
        sandbox = sinon.sandbox.create();
        producerInitStub = sandbox.stub(KafkaProducer.prototype, 'init');
        consumerInitStub = sandbox.stub(KafkaConsumer.prototype, 'init');
        dependencyInitStub = sandbox.stub(DependencyChecker.prototype, 'init');
        throttlingInitStub = sandbox.stub(KafkaThrottlingManager.prototype, 'init');

        // dependencyCheckerCtor = sandbox.createStubInstance(DependencyChecker);
    });

    after(() => {
        sandbox.restore();
    });

    it('All params exists', async () => {
        await kafkaConsumerManager.init(fullConfiguration);
        should(producerInitStub.calledOnce).eql(true);
        should(consumerInitStub.calledOnce).eql(true);
        should(dependencyInitStub.calledOnce).eql(true);
    });

    it('All params are missing', async () => {
        let config = {};

        try {
            await kafkaConsumerManager.init(config, () => {
            });
            throw new Error('Should fail');
        } catch (err) {
            err.message.should.eql('Missing mandatory environment variables: KafkaUrl,GroupId,KafkaOffsetDiffThreshold,KafkaConnectionTimeout,Topics,AutoCommit');
        }
    });

    Object.keys(fullConfiguration).forEach(key => {
        it('Test without ' + key + ' param', async () => {
            let clonedConfig = JSON.parse(JSON.stringify(fullConfiguration));
            delete clonedConfig[key];

            try {
                await kafkaConsumerManager.init(clonedConfig, () => {
                });
                throw new Error('Should fail');
            } catch (err) {
                if (key.toUpperCase().indexOf('FUNCTION') > -1) {
                    err.message.should.eql(key + ' should be a valid function');
                } else {
                    err.message.should.eql('Missing mandatory environment variables: ' + key);
                }
            }
        });
    });

    it('ResumePauseIntervalMs exists without the ResumePauseCheckFunction should fail', async () => {
        let fullConfigurationWithPauseResume = JSON.parse(JSON.stringify(fullConfiguration));
        fullConfigurationWithPauseResume.ResumePauseIntervalMs = 1000;
        try {
            await kafkaConsumerManager.init(fullConfigurationWithPauseResume, () => {
            });
            throw new Error('Should fail');
        } catch (err) {
            err.message.should.eql('ResumePauseCheckFunction should be a valid function');
        }
    });

    it('ResumePauseIntervalMs exists with the ResumePauseCheckFunction should success', async () => {
        let fullConfigurationWithPauseResume = JSON.parse(JSON.stringify(fullConfiguration));
        fullConfigurationWithPauseResume.ResumePauseIntervalMs = 1000;
        fullConfigurationWithPauseResume.ResumePauseCheckFunction = () => {
            return Promise.resolve();
        };
        fullConfigurationWithPauseResume.MessageFunction = () => {
            return Promise.resolve();
        };
        await kafkaConsumerManager.init(fullConfigurationWithPauseResume);
    });
});

describe('Verify export functions', () => {
    let sandbox, resumeStub, pauseStub, validateOffsetsAreSyncedStub,
        closeConnectionStub, decreaseMessageInMemoryStub, kafkaConsumerManager
        , dependencyInitStub, throttlingInitStub;

    before(async () => {
        kafkaConsumerManager = new KafkaConsumerManager();
        sandbox = sinon.sandbox.create();
        resumeStub = sandbox.stub();
        pauseStub = sandbox.stub();
        validateOffsetsAreSyncedStub = sandbox.stub();
        closeConnectionStub = sandbox.stub();
        decreaseMessageInMemoryStub = sandbox.stub();

        sandbox.stub(KafkaProducer.prototype, 'init').resolves();
        sandbox.stub(KafkaConsumer.prototype, 'init').resolves();
        dependencyInitStub = sandbox.stub(DependencyChecker.prototype, 'init');
        throttlingInitStub = sandbox.stub(KafkaThrottlingManager.prototype, 'init');

        await kafkaConsumerManager.init(fullConfiguration);

        let consumer = {
            resume: resumeStub,
            pause: pauseStub,
            validateOffsetsAreSynced: validateOffsetsAreSyncedStub,
            closeConnection: closeConnectionStub,
            decreaseMessageInMemory: decreaseMessageInMemoryStub
        };
        kafkaConsumerManager.chosenConsumer = consumer;
    });

    after(() => {
        sandbox.restore();
    });

    it('Verify methods going to the correct consumer', () => {
        kafkaConsumerManager.resume();
        should(resumeStub.calledOnce).eql(true);

        kafkaConsumerManager.pause();
        should(pauseStub.calledOnce).eql(true);

        kafkaConsumerManager.validateOffsetsAreSynced();
        should(validateOffsetsAreSyncedStub.calledOnce).eql(true);

        kafkaConsumerManager.closeConnection();
        should(closeConnectionStub.calledOnce).eql(true);

        kafkaConsumerManager.finishedHandlingMessage();
        should(decreaseMessageInMemoryStub.calledOnce).eql(true);
    });
});