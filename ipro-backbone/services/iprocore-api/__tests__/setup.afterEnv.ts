type FetchMock = jest.Mock<Promise<Response>, [input: unknown, init?: unknown]>;

const fetchMock = (globalThis as typeof globalThis & { __iprocoreFetchMock?: FetchMock }).__iprocoreFetchMock;

beforeEach(() => {
    fetchMock?.mockClear();
});

afterEach(() => {
    jest.clearAllMocks();
});

afterAll(async () => {
    fetchMock?.mockReset();
});
