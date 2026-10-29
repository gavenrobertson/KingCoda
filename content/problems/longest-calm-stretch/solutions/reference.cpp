class Solution {
public:
    int longestCalm(vector<int>& speeds, int k) {
        deque<int> hi, lo;  // indices of max / min candidates
        int left = 0, best = 0;
        for (int right = 0; right < (int)speeds.size(); right++) {
            while (!hi.empty() && speeds[hi.back()] <= speeds[right]) hi.pop_back();
            while (!lo.empty() && speeds[lo.back()] >= speeds[right]) lo.pop_back();
            hi.push_back(right);
            lo.push_back(right);
            while ((long long)speeds[hi.front()] - speeds[lo.front()] > k) {
                left++;
                if (hi.front() < left) hi.pop_front();
                if (lo.front() < left) lo.pop_front();
            }
            best = max(best, right - left + 1);
        }
        return best;
    }
};
