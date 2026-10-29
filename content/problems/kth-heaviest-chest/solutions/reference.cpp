class Solution {
public:
    int kthHeaviest(vector<int>& chests, int k) {
        priority_queue<int, vector<int>, greater<int>> heaviest;
        for (int w : chests) {
            heaviest.push(w);
            if ((int)heaviest.size() > k) heaviest.pop();
        }
        return heaviest.top();
    }
};
