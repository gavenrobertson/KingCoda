class Solution {
public:
    vector<long long> ledgerSums(vector<int>& taxes, vector<vector<int>>& queries) {
        vector<long long> prefix(taxes.size() + 1, 0);
        for (size_t i = 0; i < taxes.size(); i++) prefix[i + 1] = prefix[i] + taxes[i];
        vector<long long> out;
        out.reserve(queries.size());
        for (auto& q : queries) out.push_back(prefix[q[1] + 1] - prefix[q[0]]);
        return out;
    }
};
