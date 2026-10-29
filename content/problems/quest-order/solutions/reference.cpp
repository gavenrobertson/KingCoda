class Solution {
public:
    bool canFinishAll(int quests, vector<vector<int>>& prereqs) {
        vector<vector<int>> unlocks(quests);
        vector<int> waiting(quests, 0);
        for (auto& r : prereqs) {
            unlocks[r[1]].push_back(r[0]);
            waiting[r[0]]++;
        }
        vector<int> ready;
        for (int q = 0; q < quests; q++)
            if (waiting[q] == 0) ready.push_back(q);
        int done = 0;
        while (!ready.empty()) {
            int q = ready.back();
            ready.pop_back();
            done++;
            for (int next : unlocks[q])
                if (--waiting[next] == 0) ready.push_back(next);
        }
        return done == quests;
    }
};
