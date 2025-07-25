import {
  axios, ConfigurationError,
} from "@pipedream/platform";

export default {
  type: "app",
  app: "jobber",
  propDefinitions: {
    clientId: {
      type: "string",
      label: "Client ID",
      description: "The ID of the client",
      async options() {
        const { data: { clients: { nodes } } } = await this.post({
          data: {
            query: `query GetClients {
              clients {
                nodes {
                  id
                  firstName
                  lastName
                  companyName
                }
              }
            }`,
          },
        });
        return nodes.map(({
          id: value, firstName, lastName, companyName,
        }) => ({
          value,
          label: companyName || `${firstName} ${lastName}`,
        }));
      },
    },
    propertyId: {
      type: "string",
      label: "Property ID",
      description: "The ID of a property",
      async options({ clientId }) {
        const filter = clientId
          ? `(filter: { clientId: "${clientId}" })`
          : "";
        const { data: { properties: { nodes } } } = await this.post({
          data: {
            query: `query GetProperties {
              properties${filter} {
                nodes {
                  id
                  address {
                    street
                  }
                }
              }
            }`,
          },
        });
        return nodes.map(({
          id: value, address,
        }) => ({
          value,
          label: address.street,
        }));
      },
    },
  },
  methods: {
    _baseUrl() {
      return "https://api.getjobber.com/api";
    },
    async _makeRequest(opts = {}) {
      const {
        $ = this,
        path,
        ...otherOpts
      } = opts;
      const response = await axios($, {
        ...otherOpts,
        url: `${this._baseUrl()}${path}`,
        headers: {
          "Authorization": `Bearer ${this.$auth.oauth_access_token}`,
          "X-JOBBER-GRAPHQL-VERSION": "2025-01-20",
        },
      });
      if (response.errors) {
        console.log(JSON.stringify(response, null, 2));
        throw new ConfigurationError(response.errors[0].message);
      }
      return response;
    },
    post(opts = {}) {
      return this._makeRequest({
        method: "POST",
        path: "/graphql",
        ...opts,
      });
    },
    async *paginate({
      query,
      args = {},
      resourceKey,
      max,
    }) {
      let counter = 0;
      let hasNextPage;
      let endCursor;
      do {
        const variables = {
          after: endCursor,
          first: 10,
          ...args,
        };
        const { data } = await this.post({
          data: {
            query,
            variables,
          },
        });
        const {
          nodes, pageInfo,
        } = data[resourceKey];
        if (!nodes?.length) {
          return;
        }
        for (const node of nodes) {
          counter += 1;
          yield node;
        }
        ({
          hasNextPage, endCursor,
        } = pageInfo);
      } while (hasNextPage && counter < max);
    },
    async getPaginatedResources(args) {
      const results = [];
      const resources = this.paginate(args);
      for await (const resource of resources) {
        results.push(resource);
      }
      return results;
    },
  },
};
